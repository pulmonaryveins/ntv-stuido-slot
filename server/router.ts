import { bffConfigured } from './env.js'
import { fail, json, requestOrigin } from './http.js'
import { getSession } from './session.js'
import * as auth from './routes/auth.js'
import { board, isKnownRpc, rpc } from './routes/board.js'
import { stream } from './routes/stream.js'

/** Header the app sends on every state-changing request (CSRF: cross-site forms cannot set it). */
export const CSRF_HEADER = 'x-studio-csrf'

type Handler = (request: Request) => Promise<Response>

const AUTH_ROUTES: Record<string, { method: 'GET' | 'POST'; handler: Handler }> = {
  'auth/me': { method: 'GET', handler: auth.me },
  'auth/callback': { method: 'GET', handler: auth.callback },
  'auth/login': { method: 'POST', handler: auth.login },
  'auth/register': { method: 'POST', handler: auth.register },
  'auth/resend': { method: 'POST', handler: auth.resend },
  'auth/reset': { method: 'POST', handler: auth.reset },
  'auth/password': { method: 'POST', handler: auth.updatePassword },
  'auth/logout': { method: 'POST', handler: auth.logout },
}

/** `/api/board` locally, or `/api?path=board` after the Vercel rewrite. */
function routePath(url: URL): string {
  if (url.pathname === '/api' || url.pathname === '/api/') return (url.searchParams.get('path') ?? '').replace(/^\/+|\/+$/g, '')
  return url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '')
}

function csrfOk(request: Request): boolean {
  if (request.headers.get(CSRF_HEADER) !== '1') return false
  const origin = request.headers.get('origin')
  return !origin || origin === requestOrigin(request)
}

function withHeader(res: Response, name: string, value: string | undefined): Response {
  if (value) res.headers.append(name, value)
  return res
}

/** Single entry for every /api request (Vercel function and Vite dev middleware). */
export async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const path = routePath(url)
  const method = request.method.toUpperCase()

  try {
    if (path === 'health') return json({ ok: true, configured: bffConfigured() })
    if (!bffConfigured()) return fail('server_misconfigured', 503)

    if (method !== 'GET' && method !== 'POST') return fail('method_not_allowed', 405)
    if (method === 'POST' && !csrfOk(request)) return fail('csrf', 403)

    const authRoute = AUTH_ROUTES[path]
    if (authRoute) {
      if (authRoute.method !== method) return fail('method_not_allowed', 405)
      return await authRoute.handler(request)
    }

    if (path === 'board' || path === 'stream' || path.startsWith('rpc/')) {
      const name = path.slice('rpc/'.length)
      if (path.startsWith('rpc/') && (method !== 'POST' || !isKnownRpc(name))) return fail('not_found', 404)
      if ((path === 'board' || path === 'stream') && method !== 'GET') return fail('method_not_allowed', 405)

      const { session, setCookie } = await getSession(request)
      if (!session) return withHeader(fail('signed_out', 401), 'Set-Cookie', setCookie)

      if (path === 'stream') return stream(request, session, setCookie ? { 'Set-Cookie': setCookie } : {})
      const res = path === 'board' ? await board(session) : await rpc(request, session, name)
      return withHeader(res, 'Set-Cookie', setCookie)
    }

    return fail('not_found', 404)
  } catch (e) {
    console.error('[bff] unhandled', e)
    return fail('server_error', 500)
  }
}
