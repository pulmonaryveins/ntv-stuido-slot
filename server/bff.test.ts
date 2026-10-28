import { beforeAll, describe, expect, it } from 'vitest'
import { seal, unseal } from './seal.js'
import { allowAttempt } from './limiter.js'
import { validateArgs } from './routes/board.js'
import { handle } from './router.js'
import { resetEnvCache } from './env.js'

const ORIGIN = 'http://localhost:5173'

beforeAll(() => {
  // Dummy values: none of the tested paths reach Supabase.
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_ANON_KEY = 'test-anon-key'
  process.env.SESSION_SECRET = 'x'.repeat(40)
  resetEnvCache()
})

const req = (path: string, init: RequestInit & { csrf?: boolean } = {}) => {
  const headers = new Headers(init.headers)
  headers.set('host', 'localhost:5173')
  if (init.csrf) headers.set('x-studio-csrf', '1')
  return new Request(`${ORIGIN}/api/${path}`, { ...init, headers })
}
const body = async (r: Response) => (await r.json()) as { error?: string }

describe('sealed cookies', () => {
  it('round-trips and rejects tampering or a different secret', async () => {
    const token = await seal({ hello: 'world' }, 'a'.repeat(32))
    expect(await unseal(token, 'a'.repeat(32))).toEqual({ hello: 'world' })
    expect(await unseal(token, 'b'.repeat(32))).toBeNull()
    const flipped = token.slice(0, -2) + (token.endsWith('A') ? 'B' : 'A') + token.slice(-1)
    expect(await unseal(flipped, 'a'.repeat(32))).toBeNull()
    expect(await unseal('not-a-token', 'a'.repeat(32))).toBeNull()
  })
})

describe('router security', () => {
  it('health is public', async () => {
    const r = await handle(req('health'))
    expect(r.status).toBe(200)
  })

  it('board and stream need a session', async () => {
    expect((await handle(req('board'))).status).toBe(401)
    expect((await handle(req('stream'))).status).toBe(401)
  })

  it('a forged session cookie is rejected and cleared', async () => {
    const r = await handle(req('board', { headers: { cookie: 'ss_session=forged' } }))
    expect(r.status).toBe(401)
    expect(r.headers.get('set-cookie')).toMatch(/ss_session=;.*Max-Age=0/)
  })

  it('POST without the CSRF header or from another origin is refused', async () => {
    expect((await handle(req('rpc/join_queue', { method: 'POST', body: '{}' }))).status).toBe(403)
    const crossSite = req('rpc/join_queue', { method: 'POST', body: '{}', csrf: true, headers: { origin: 'https://evil.example' } })
    expect(await body(await handle(crossSite))).toEqual({ error: 'csrf' })
  })

  it('only allowlisted RPCs are reachable', async () => {
    const r = await handle(req('rpc/tick', { method: 'POST', body: '{}', csrf: true }))
    expect(r.status).toBe(404)
    const r2 = await handle(req('rpc/claim_slot', { method: 'GET' }))
    expect(r2.status).toBe(404)
  })

  it('unknown routes and methods are refused', async () => {
    expect((await handle(req('rest/v1/slots'))).status).toBe(404)
    expect((await handle(req('board', { method: 'DELETE' }))).status).toBe(405)
    expect((await handle(req('auth/login', { method: 'GET' }))).status).toBe(405)
  })

  it('login validates input before contacting Supabase', async () => {
    const r = await handle(req('auth/login', { method: 'POST', body: JSON.stringify({ email: 'nope' }), csrf: true }))
    expect(r.status).toBe(400)
  })

  it('works behind the Vercel rewrite (/api?path=…)', async () => {
    const r = await handle(new Request(`${ORIGIN}/api?path=board`, { headers: { host: 'localhost:5173' } }))
    expect(r.status).toBe(401)
  })
})

describe('RPC argument validation', () => {
  it('accepts exact shapes only', () => {
    expect(validateArgs('claim_slot', { p_slot_id: 1, p_status: 'editing', p_minutes: 60 })).toEqual({
      p_slot_id: 1,
      p_status: 'editing',
      p_minutes: 60,
    })
    expect(validateArgs('claim_slot', { p_slot_id: '1', p_status: 'editing', p_minutes: 60 })).toBeNull()
    expect(validateArgs('claim_slot', { p_slot_id: 1, p_status: 'editing' })).toBeNull()
    expect(validateArgs('claim_slot', { p_slot_id: 1, p_status: 'editing', p_minutes: 60, extra: 1 })).toBeNull()
    expect(validateArgs('set_status', { p_slot_id: 1, p_status: 'editing' })).toEqual({
      p_slot_id: 1,
      p_status: 'editing',
      p_render_eta: null,
    })
    expect(validateArgs('join_queue', [])).toBeNull()
    expect(validateArgs('drop_everything', {})).toBeNull()
  })
})

describe('attempt limiter', () => {
  it('blocks after the limit within the window', () => {
    const now = 1_000_000
    for (let i = 0; i < 3; i++) expect(allowAttempt('k', 3, now)).toBe(true)
    expect(allowAttempt('k', 3, now)).toBe(false)
    expect(allowAttempt('k', 3, now + 16 * 60_000)).toBe(true)
  })
})
