import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { handle } from './router.js'

/** Node request -> Web Request (body buffered; abort when the client disconnects). */
async function toRequest(req: IncomingMessage & { originalUrl?: string }, res: ServerResponse): Promise<Request> {
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) for (const item of v) headers.append(k, item)
    else if (v !== undefined) headers.set(k, v)
  }
  const controller = new AbortController()
  res.on('close', () => controller.abort())
  const method = req.method ?? 'GET'
  let body: Uint8Array | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    body = new Uint8Array(Buffer.concat(chunks))
  }
  return new Request(`http://${req.headers.host ?? 'localhost'}${req.originalUrl ?? req.url ?? '/'}`, {
    method,
    headers,
    body: body as BodyInit | undefined,
    signal: controller.signal,
  })
}

/** Web Response -> Node response, streaming the body (needed for SSE). */
async function send(res: ServerResponse, response: Response) {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    if (key !== 'set-cookie') res.setHeader(key, value)
  })
  const cookies = response.headers.getSetCookie()
  if (cookies.length) res.setHeader('Set-Cookie', cookies)
  if (!response.body) return void res.end()
  res.flushHeaders()
  const reader = response.body.getReader()
  res.on('close', () => void reader.cancel().catch(() => {}))
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
  } catch {
    /* client went away */
  }
  res.end()
}

/** Serves the BFF under /api inside `vite dev` and `vite preview` (same code as the Vercel function). */
export function bffPlugin(): Plugin {
  // Must return nothing: Vite treats a function returned from configureServer as a post-hook.
  const mount = (server: { middlewares: { use: (path: string, fn: (req: IncomingMessage, res: ServerResponse) => void) => unknown } }): void => {
    server.middlewares.use('/api', (req, res) => {
      void toRequest(req, res)
        .then(handle)
        .then((response) => send(res, response))
        .catch((e) => {
          console.error('[bff]', e)
          if (!res.headersSent) res.statusCode = 500
          res.end()
        })
    })
  }
  return { name: 'studio-bff', configureServer: mount, configurePreviewServer: mount }
}
