/**
 * Server-only configuration. None of these are exposed to the browser bundle
 * (no VITE_ prefix). Set them in `.env` locally and in Vercel project settings.
 */
export interface ServerEnv {
  supabaseUrl: string
  supabaseAnonKey: string
  /** 32+ random characters; encrypts the session cookie. */
  sessionSecret: string
  production: boolean
}

let cached: ServerEnv | null = null
let warnedDevSecret = false

export function serverEnv(): ServerEnv {
  if (cached) return cached
  const production = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  const supabaseUrl = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '')
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? ''
  let sessionSecret = process.env.SESSION_SECRET ?? ''

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set for the BFF')
  }
  if (sessionSecret.length < 32) {
    if (production) throw new Error('SESSION_SECRET must be at least 32 characters in production')
    // Dev convenience: a random per-process secret (sessions reset on restart).
    sessionSecret = crypto.randomUUID() + crypto.randomUUID()
    if (!warnedDevSecret) {
      warnedDevSecret = true
      console.warn('[bff] SESSION_SECRET not set: using a temporary dev secret (you will be signed out on restart)')
    }
  }
  cached = { supabaseUrl, supabaseAnonKey, sessionSecret, production }
  return cached
}

export function bffConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
}

/** Test hook. */
export function resetEnvCache() {
  cached = null
}
