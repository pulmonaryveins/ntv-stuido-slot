import { create } from 'zustand'
import type { AuthError } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { WorkRole } from '../data'
import { useStudio } from './studio'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'recovery'

export const MIN_PASSWORD = 8

interface AuthState {
  status: AuthStatus
  userId: string | null
  email: string | null
  /** Result of the last form submit: error text or an info message to show. */
  error: string | null
  notice: string | null
  busy: boolean
  /** Email awaiting confirmation after registering (drives the "check your email" screen). */
  pendingEmail: string | null

  signIn(email: string, password: string): Promise<void>
  signUp(input: { name: string; workRole: WorkRole; email: string; password: string }): Promise<void>
  requestReset(email: string): Promise<void>
  resendConfirmation(): Promise<boolean>
  cancelPending(): void
  updatePassword(password: string): Promise<void>
  signOut(): Promise<void>
  clearMessages(): void
}

function friendly(error: AuthError): string {
  const m = error.message
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password.'
  if (/already registered|already been registered/i.test(m)) return 'That email already has an account. Sign in instead.'
  if (/email not confirmed/i.test(m)) return 'Confirm your email first: check your inbox for the link.'
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again.'
  if (/password/i.test(m)) return m
  return m || 'Something went wrong. Try again.'
}

export const useAuth = create<AuthState>((set, get) => ({
  status: supabaseConfigured ? 'loading' : 'signedOut',
  userId: null,
  email: null,
  error: null,
  notice: null,
  busy: false,
  pendingEmail: null,

  clearMessages: () => set({ error: null, notice: null }),

  cancelPending: () => set({ pendingEmail: null, error: null, notice: null }),

  resendConfirmation: async () => {
    const email = get().pendingEmail
    if (!email) return false
    set({ error: null })
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) set({ error: friendly(error) })
    return !error
  },

  signIn: async (email, password) => {
    set({ busy: true, error: null, notice: null })
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    set({ busy: false, error: error ? friendly(error) : null })
  },

  signUp: async ({ name, workRole, email, password }) => {
    set({ busy: true, error: null, notice: null })
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { name: name.trim(), work_role: workRole },
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) {
      set({ busy: false, error: friendly(error) })
      return
    }
    // Email confirmation on: no session yet. Confirmation off: onAuthStateChange signs in.
    // Supabase returns an empty identities list for an already-registered email.
    if (data.user && data.user.identities?.length === 0) {
      set({ busy: false, error: 'That email already has an account. Sign in instead.' })
      return
    }
    // Email confirmation on: no session yet, show the "check your email" screen.
    set({ busy: false, pendingEmail: data.session ? null : email.trim() })
  },

  requestReset: async (email) => {
    set({ busy: true, error: null, notice: null })
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    set({
      busy: false,
      error: error ? friendly(error) : null,
      notice: error ? null : 'If that email has an account, a reset link is on its way.',
    })
  },

  updatePassword: async (password) => {
    set({ busy: true, error: null, notice: null })
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      set({ busy: false, error: friendly(error) })
      return
    }
    set({ busy: false, status: get().userId ? 'signedIn' : 'signedOut', notice: 'Password updated.' })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    // Reload so the board store, realtime channels and timers start clean for the next user.
    window.location.reload()
  },
}))

/** What the URL says about an email link the user just followed (read before supabase-js strips it). */
function readLinkResult(): { confirmed: boolean; error: string | null } {
  if (typeof window === 'undefined') return { confirmed: false, error: null }
  const params = new URLSearchParams(`${window.location.hash.replace(/^#/, '')}&${window.location.search.replace(/^\?/, '')}`)
  const type = params.get('type')
  const errorCode = params.get('error_code')
  const error = params.get('error_description')
  if (errorCode || error) {
    window.history.replaceState(null, '', window.location.pathname)
    return {
      confirmed: false,
      error: errorCode === 'otp_expired'
        ? 'That email link expired or was already used. Sign in, or register again to get a new one.'
        : (error ?? 'That email link did not work.').replace(/\+/g, ' '),
    }
  }
  return { confirmed: type === 'signup' || type === 'email', error: null }
}

let initialised = false

/** Wire Supabase auth events into the store. Call once on app start. */
export function initAuth() {
  if (initialised || !supabaseConfigured) return
  initialised = true
  const link = readLinkResult()
  if (link.error) useAuth.setState({ error: link.error })
  let welcomePending = link.confirmed
  const apply = (event: string, session: { user: { id: string; email?: string } } | null) => {
    if (event === 'PASSWORD_RECOVERY') {
      useAuth.setState({ status: 'recovery', userId: session?.user.id ?? null, email: session?.user.email ?? null })
      return
    }
    if (session && welcomePending) {
      welcomePending = false
      useStudio.getState().pushToast({ kind: 'info', title: 'Email confirmed', body: 'Welcome to Studio Slots!' })
    }
    useAuth.setState((s) => ({
      pendingEmail: session ? null : s.pendingEmail,
      status: session ? (s.status === 'recovery' ? 'recovery' : 'signedIn') : 'signedOut',
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,
      error: session ? null : s.error,
    }))
  }
  supabase.auth.onAuthStateChange((event, session) => apply(event, session))
  void supabase.auth.getSession().then(({ data }) => {
    if (useAuth.getState().status === 'loading') apply('INITIAL_SESSION', data.session)
  })
}
