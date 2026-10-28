import type { Session } from '@supabase/supabase-js'
import { serverEnv } from './env.js'
import { parseCookies, serializeCookie } from './http.js'
import { seal, unseal } from './seal.js'
import { anonClient } from './supabase.js'

export const SESSION_COOKIE = 'ss_session'
export const PKCE_COOKIE = 'ss_pkce'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30
const REFRESH_MARGIN_S = 60

/** What the encrypted session cookie holds. Never sent to browser JS (httpOnly). */
export interface StoredSession {
  access: string
  refresh: string
  userId: string
  email: string | null
  /** Access token expiry, unix seconds. */
  exp: number
}

export function fromSupabase(s: Session): StoredSession {
  return {
    access: s.access_token,
    refresh: s.refresh_token,
    userId: s.user.id,
    email: s.user.email ?? null,
    exp: s.expires_at ?? Math.floor(Date.now() / 1000) + (s.expires_in ?? 3600),
  }
}

export function isSecure(request: Request): boolean {
  const proto = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '')
  return proto === 'https' || serverEnv().production
}

export async function sessionCookie(request: Request, s: StoredSession): Promise<string> {
  return serializeCookie(SESSION_COOKIE, await seal(s, serverEnv().sessionSecret), {
    path: '/api',
    maxAge: SESSION_MAX_AGE,
    secure: isSecure(request),
  })
}

export function clearCookie(request: Request, name: string, path = '/api'): string {
  return serializeCookie(name, '', { path, maxAge: 0, secure: isSecure(request) })
}

export async function pkceCookie(request: Request, verifier: string): Promise<string> {
  return serializeCookie(PKCE_COOKIE, await seal({ v: verifier }, serverEnv().sessionSecret), {
    path: '/api/auth',
    maxAge: 60 * 60,
    secure: isSecure(request),
  })
}

export async function readPkce(request: Request): Promise<string | null> {
  const raw = parseCookies(request.headers.get('cookie'))[PKCE_COOKIE]
  return (await unseal<{ v: string }>(raw, serverEnv().sessionSecret))?.v ?? null
}

/**
 * Session from the cookie, refreshed when the access token is (nearly) expired.
 * `setCookie` is the header to send back when the session changed or was cleared.
 */
export async function getSession(request: Request): Promise<{ session: StoredSession | null; setCookie?: string }> {
  const raw = parseCookies(request.headers.get('cookie'))[SESSION_COOKIE]
  const stored = await unseal<StoredSession>(raw, serverEnv().sessionSecret)
  if (!stored) return raw ? { session: null, setCookie: clearCookie(request, SESSION_COOKIE) } : { session: null }

  if (stored.exp - Math.floor(Date.now() / 1000) > REFRESH_MARGIN_S) return { session: stored }

  const { data, error } = await anonClient().auth.refreshSession({ refresh_token: stored.refresh })
  if (error || !data.session) return { session: null, setCookie: clearCookie(request, SESSION_COOKIE) }
  const next = fromSupabase(data.session)
  return { session: next, setCookie: await sessionCookie(request, next) }
}
