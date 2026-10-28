import type { StoredSession } from '../session.js'
import { userClient } from '../supabase.js'

/** Keep under the function's maxDuration (vercel.json); EventSource reconnects by itself. */
export const STREAM_LIFETIME_MS = 50_000
const PING_MS = 20_000
const TABLES = ['slots', 'queue', 'activity_log'] as const

/**
 * GET /api/stream: Server-Sent Events relay. The BFF joins the private Supabase Realtime
 * channel with the user's token and forwards a bare `change` event; the browser refetches
 * /api/board. No tokens or row data cross this stream.
 */
export function stream(request: Request, session: StoredSession, extraHeaders: HeadersInit = {}): Response {
  const db = userClient(session.access)
  const encoder = new TextEncoder()
  let cleanup: (() => void) | null = null

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      const send = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          close()
        }
      }
      void db.realtime.setAuth(session.access)
      const channel = db.channel('studio-board', { config: { private: true } })
      for (const table of TABLES) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => send('event: change\ndata: {}\n\n'))
      }
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') send('event: ready\ndata: {}\n\n')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') close()
      })

      const ping = setInterval(() => send(': ping\n\n'), PING_MS)
      const lifetime = setTimeout(() => close(), STREAM_LIFETIME_MS)

      function close() {
        if (closed) return
        closed = true
        clearInterval(ping)
        clearTimeout(lifetime)
        void db.removeChannel(channel).finally(() => db.realtime.disconnect())
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
      cleanup = close
      request.signal.addEventListener('abort', close)
      send('retry: 1500\n\n')
    },
    cancel() {
      cleanup?.()
    },
  })

  const headers = new Headers(extraHeaders)
  headers.set('Content-Type', 'text/event-stream; charset=utf-8')
  headers.set('Cache-Control', 'no-store, no-transform')
  headers.set('Connection', 'keep-alive')
  headers.set('X-Accel-Buffering', 'no')
  return new Response(body, { headers })
}
