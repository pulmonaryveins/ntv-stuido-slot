import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.js'
import { serverEnv } from './env.js'

export type Db = SupabaseClient<Database>

const BASE = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const

/** Unauthenticated client (sign-in, sign-up, refresh). */
export function anonClient(): Db {
  const env = serverEnv()
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, { auth: BASE })
}

/** Client acting as the signed-in user: every query runs under RLS with their JWT. */
export function userClient(accessToken: string): Db {
  const env = serverEnv()
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: BASE,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

/** PKCE storage key: the code verifier lives under `${PKCE_STORAGE_KEY}-code-verifier`. */
export const PKCE_STORAGE_KEY = 'ss'

/**
 * Client for email-link flows (sign-up confirmation, resend, password reset) using PKCE.
 * The verifier is captured in `store` so the BFF can keep it in an httpOnly cookie and the
 * link comes back to /api/auth/callback with a one-time `code` instead of tokens in the URL.
 */
export function pkceClient(store: Map<string, string>): Db {
  const env = serverEnv()
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      ...BASE,
      flowType: 'pkce',
      storageKey: PKCE_STORAGE_KEY,
      storage: {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => void store.set(k, v),
        removeItem: (k) => void store.delete(k),
      },
    },
  })
}
