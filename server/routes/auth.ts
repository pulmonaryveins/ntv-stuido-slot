import type { AuthError } from '@supabase/supabase-js'
import { clientIp, fail, json, readJson, requestOrigin } from '../http.js'
import {
  PKCE_COOKIE,
  SESSION_COOKIE,
  clearCookie,
  fromSupabase,
  getSession,
  pkceCookie,
  readPkce,
  sessionCookie,
} from '../session.js'
import { PKCE_STORAGE_KEY, anonClient, pkceClient, userClient } from '../supabase.js'
import { allowAttempt, clearAttempts } from '../limiter.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WORK_ROLES = new Set(['editor', 'designer', 'motion'])
/** Windows device name / hostname (all workstations are Windows): letters, digits, dashes, max 15. */
const DEVICE_NAME_RE = /^[A-Z0-9-]{1,15}$/
const VERIFIER_KEY = `${PKCE_STORAGE_KEY}-code-verifier`

const str = (v: unknown, max = 320): string | null => (typeof v === 'string' && v.length <= max ? v : null)

function authError(error: AuthError): Response {
  const m = error.message
  if (/invalid login credentials/i.test(m)) return fail('invalid_credentials', 401, 'Wrong email or password.')
  if (/email not confirmed/i.test(m)) return fail('email_not_confirmed', 403, 'Confirm your email first: check your inbox for the link.')
  if (/already registered|already been registered/i.test(m)) return fail('email_taken', 409, 'That email already has an account. Sign in instead.')
  if (/rate limit|too many/i.test(m) || error.status === 429) return fail('rate_limited', 429, 'Too many attempts. Wait a minute and try again.')
  if (/password/i.test(m)) return fail('weak_password', 400, m)
  return fail('auth_failed', 400, 'Something went wrong. Try again.')
}

function withCookies(res: Response, cookies: (string | undefined)[]): Response {
  for (const c of cookies) if (c) res.headers.append('Set-Cookie', c)
  return res
}

/** GET /api/auth/me: signed-in user and their profile status (for the approval gate). */
export async function me(request: Request): Promise<Response> {
  const { session, setCookie } = await getSession(request)
  if (!session) return withCookies(fail('signed_out', 401), [setCookie])
  const { data } = await userClient(session.access)
    .from('profiles')
    .select('id, name, role, active')
    .eq('id', session.userId)
    .maybeSingle()
  return withCookies(
    json({ user: { id: session.userId, email: session.email }, profile: data ?? null }),
    [setCookie],
  )
}

/** POST /api/auth/login */
export async function login(request: Request): Promise<Response> {
  const body = await readJson<{ email?: unknown; password?: unknown }>(request)
  const email = str(body?.email)?.trim().toLowerCase()
  const password = str(body?.password, 200)
  if (!email || !password || !EMAIL_RE.test(email)) return fail('invalid_input', 400, 'Enter your email and password.')

  // Supabase sees the BFF's IP for every user, so throttle per client IP + email here.
  const ip = clientIp(request)
  if (!allowAttempt(`login:${ip}:${email}`, 10) || !allowAttempt(`login-ip:${ip}`, 50)) {
    return fail('rate_limited', 429, 'Too many sign-in attempts. Wait a few minutes and try again.')
  }

  const { data, error } = await anonClient().auth.signInWithPassword({ email, password })
  if (error || !data.session) return error ? authError(error) : fail('auth_failed', 400)
  clearAttempts(`login:${ip}:${email}`)
  return withCookies(json({ ok: true }), [await sessionCookie(request, fromSupabase(data.session))])
}

/** POST /api/auth/register */
export async function register(request: Request): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request)
  const name = str(body?.name, 60)?.trim()
  const workRole = str(body?.workRole, 20)
  const email = str(body?.email)?.trim().toLowerCase()
  const password = str(body?.password, 72)
  const deviceName = str(body?.deviceName, 40)?.trim().toUpperCase()
  if (!deviceName || !DEVICE_NAME_RE.test(deviceName)) {
    return fail('invalid_input', 400, 'Enter your device name (Settings › System › About, or hostname): letters, numbers and dashes, max 15.')
  }
  // Work role is optional now (defaults to designer in the signup trigger).
  if (!name || (workRole && !WORK_ROLES.has(workRole)) || !email || !EMAIL_RE.test(email)) {
    return fail('invalid_input', 400, 'Fill in your name and a valid email.')
  }
  if (!password || password.length < 8) return fail('weak_password', 400, 'Password must be at least 8 characters.')
  if (!allowAttempt(`register:${clientIp(request)}`, 10)) {
    return fail('rate_limited', 429, 'Too many sign-ups from this network. Try again later.')
  }
  if ((await deviceAvailable(deviceName)) === false) return deviceTaken()

  const store = new Map<string, string>()
  const { data, error } = await pkceClient(store).auth.signUp({
    email,
    password,
    options: {
      data: { name, ...(workRole ? { work_role: workRole } : {}), device_name: deviceName },
      emailRedirectTo: `${requestOrigin(request)}/api/auth/callback?next=confirmed`,
    },
  })
  if (error) return authError(error)
  // Supabase hides "already registered" behind an empty identities list.
  if (data.user && data.user.identities?.length === 0) {
    return fail('email_taken', 409, 'That email already has an account. Sign in instead.')
  }
  if (data.session) {
    return withCookies(json({ signedIn: true }), [await sessionCookie(request, fromSupabase(data.session))])
  }
  const verifier = store.get(VERIFIER_KEY)
  return withCookies(json({ pending: true }), [verifier ? await pkceCookie(request, verifier) : undefined])
}

const deviceTaken = () =>
  fail('device_taken', 409, 'That device name is already registered to another account. Check the name, or ask an admin.')

/** true/false from the database; null when the check itself failed (sign-up then decides). */
async function deviceAvailable(name: string): Promise<boolean | null> {
  const { data, error } = await anonClient().rpc('device_name_available', { p_name: name })
  if (error) {
    console.error('[bff] device check failed', error.code, error.message)
    return null
  }
  return data === true
}

/** POST /api/auth/check-device: is this device name free? (sign-up form, as you type) */
export async function checkDevice(request: Request): Promise<Response> {
  const body = await readJson<{ deviceName?: unknown }>(request)
  const name = str(body?.deviceName, 40)?.trim().toUpperCase()
  if (!name || !DEVICE_NAME_RE.test(name)) return fail('invalid_input', 400)
  if (!allowAttempt(`check-device:${clientIp(request)}`, 30)) return fail('rate_limited', 429, 'Too many checks. Wait a minute.')
  const available = await deviceAvailable(name)
  return json({ available: available !== false })
}

/** POST /api/auth/resend: resend the sign-up confirmation email. */
export async function resend(request: Request): Promise<Response> {
  const body = await readJson<{ email?: unknown }>(request)
  const email = str(body?.email)?.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return fail('invalid_input', 400, 'Enter a valid email.')
  if (!allowAttempt(`resend:${clientIp(request)}`, 5)) return fail('rate_limited', 429, 'Too many emails. Try again later.')
  const store = new Map<string, string>()
  const { error } = await pkceClient(store).auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${requestOrigin(request)}/api/auth/callback?next=confirmed` },
  })
  if (error) return authError(error)
  const verifier = store.get(VERIFIER_KEY)
  return withCookies(json({ ok: true }), [verifier ? await pkceCookie(request, verifier) : undefined])
}

/** POST /api/auth/reset: email a password-reset link. Always answers the same way. */
export async function reset(request: Request): Promise<Response> {
  const body = await readJson<{ email?: unknown }>(request)
  const email = str(body?.email)?.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return fail('invalid_input', 400, 'Enter a valid email.')
  if (!allowAttempt(`reset:${clientIp(request)}`, 5)) return fail('rate_limited', 429, 'Too many emails. Try again later.')
  const store = new Map<string, string>()
  await pkceClient(store).auth.resetPasswordForEmail(email, {
    redirectTo: `${requestOrigin(request)}/api/auth/callback?next=recovery`,
  })
  const verifier = store.get(VERIFIER_KEY)
  return withCookies(json({ ok: true }), [verifier ? await pkceCookie(request, verifier) : undefined])
}

/**
 * GET /api/auth/callback?code=…&next=confirmed|recovery
 * Email links land here. The one-time code is exchanged server-side with the PKCE verifier
 * from the httpOnly cookie; tokens never appear in a browser URL.
 */
export async function callback(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const origin = requestOrigin(request)
  const next = url.searchParams.get('next') === 'recovery' ? 'recovery' : 'confirmed'
  const redirect = (to: string, cookies: (string | undefined)[] = []) =>
    withCookies(new Response(null, { status: 302, headers: { Location: `${origin}${to}`, 'Cache-Control': 'no-store' } }), cookies)

  const errorCode = url.searchParams.get('error_code')
  if (errorCode || url.searchParams.get('error')) {
    return redirect(`/?auth_error=${errorCode === 'otp_expired' ? 'link_expired' : 'link_invalid'}`)
  }
  const code = url.searchParams.get('code')
  const verifier = await readPkce(request)
  if (!code || !verifier) return redirect('/?auth_error=link_other_device')

  const store = new Map<string, string>([[VERIFIER_KEY, verifier]])
  const { data, error } = await pkceClient(store).auth.exchangeCodeForSession(code)
  if (error || !data.session) return redirect('/?auth_error=link_invalid', [clearCookie(request, PKCE_COOKIE, '/api/auth')])
  return redirect(next === 'recovery' ? '/?recovery=1' : '/?confirmed=1', [
    await sessionCookie(request, fromSupabase(data.session)),
    clearCookie(request, PKCE_COOKIE, '/api/auth'),
  ])
}

/** POST /api/auth/password: set a new password (after a reset link, or while signed in). */
export async function updatePassword(request: Request): Promise<Response> {
  const { session, setCookie } = await getSession(request)
  if (!session) return withCookies(fail('signed_out', 401), [setCookie])
  const body = await readJson<{ password?: unknown }>(request)
  const password = str(body?.password, 72)
  if (!password || password.length < 8) return fail('weak_password', 400, 'Password must be at least 8 characters.')

  const db = anonClient()
  const { error: sessionError } = await db.auth.setSession({ access_token: session.access, refresh_token: session.refresh })
  if (sessionError) return withCookies(fail('signed_out', 401), [clearCookie(request, SESSION_COOKIE)])
  const { error } = await db.auth.updateUser({ password })
  if (error) return authError(error)
  const { data } = await db.auth.getSession()
  return withCookies(json({ ok: true }), [
    setCookie,
    data.session ? await sessionCookie(request, fromSupabase(data.session)) : undefined,
  ])
}

/** POST /api/auth/logout: revoke this session at Supabase and drop the cookie. */
export async function logout(request: Request): Promise<Response> {
  const { session } = await getSession(request)
  if (session) {
    const db = anonClient()
    const { error } = await db.auth.setSession({ access_token: session.access, refresh_token: session.refresh })
    if (!error) await db.auth.signOut({ scope: 'local' })
  }
  return withCookies(json({ ok: true }), [clearCookie(request, SESSION_COOKIE), clearCookie(request, PKCE_COOKIE, '/api/auth')])
}
