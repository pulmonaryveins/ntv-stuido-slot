import { create } from 'zustand'
import { ApiError, api, backendMode } from '../lib/backend'
import { bffClient } from '../data'
import { useStudio } from './studio'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'recovery'

export const MIN_PASSWORD = 8

interface MeResponse {
  user: { id: string; email: string | null }
  profile: { id: string; name: string; role: string; active: boolean } | null
}

interface AuthState {
  status: AuthStatus
  userId: string | null
  email: string | null
  /** Result of the last form submit: error text or an info message to show. */
  error: string | null
  /** Which register field the error belongs to (shown under that field). */
  errorField: 'email' | 'device' | null
  notice: string | null
  busy: boolean
  /** Email awaiting confirmation after registering (drives the "check your email" screen). */
  pendingEmail: string | null
  /** Own profile's `active` flag: null = not checked yet, false = waiting for approval / deactivated. */
  profileActive: boolean | null

  /** Ask the BFF who is signed in (session lives in an httpOnly cookie). */
  refreshMe(): Promise<void>
  checkProfile(): Promise<void>
  signIn(email: string, password: string): Promise<void>
  signUp(input: { name: string; deviceName: string; email: string; password: string }): Promise<void>
  requestReset(email: string): Promise<void>
  resendConfirmation(): Promise<boolean>
  cancelPending(): void
  updatePassword(password: string): Promise<void>
  signOut(): Promise<void>
  clearMessages(): void
}

const message = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Something went wrong. Try again.'

export const useAuth = create<AuthState>((set, get) => ({
  status: backendMode === 'bff' ? 'loading' : 'signedOut',
  userId: null,
  email: null,
  error: null,
  errorField: null,
  notice: null,
  busy: false,
  pendingEmail: null,
  profileActive: null,

  refreshMe: async () => {
    try {
      const me = await api<MeResponse>('auth/me')
      bffClient?.setUserId(me.user.id)
      set((s) => ({
        status: s.status === 'recovery' ? 'recovery' : 'signedIn',
        userId: me.user.id,
        email: me.user.email,
        profileActive: !!me.profile?.active,
        pendingEmail: null,
      }))
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        bffClient?.setUserId(null)
        set({ status: 'signedOut', userId: null, email: null, profileActive: null })
      } else if (get().status === 'loading') {
        set({ status: 'signedOut', error: message(e) })
      }
    }
  },

  checkProfile: async () => {
    if (get().userId) await get().refreshMe()
  },

  clearMessages: () => set({ error: null, errorField: null, notice: null }),

  cancelPending: () => set({ pendingEmail: null, error: null, notice: null }),

  resendConfirmation: async () => {
    const email = get().pendingEmail
    if (!email) return false
    set({ error: null })
    try {
      await api('auth/resend', { body: { email } })
      return true
    } catch (e) {
      set({ error: message(e) })
      return false
    }
  },

  signIn: async (email, password) => {
    set({ busy: true, error: null, notice: null })
    try {
      await api('auth/login', { body: { email, password } })
      await get().refreshMe()
      set({ busy: false })
    } catch (e) {
      set({ busy: false, error: message(e) })
    }
  },

  signUp: async ({ name, deviceName, email, password }) => {
    set({ busy: true, error: null, errorField: null, notice: null })
    try {
      const res = await api<{ signedIn?: boolean; pending?: boolean }>('auth/register', {
        body: { name, deviceName, email, password },
      })
      if (res.signedIn) await get().refreshMe()
      set({ busy: false, pendingEmail: res.pending ? email.trim() : null })
    } catch (e) {
      const code = e instanceof ApiError ? e.code : ''
      set({
        busy: false,
        error: message(e),
        errorField: code === 'email_taken' ? 'email' : code === 'device_taken' ? 'device' : null,
      })
    }
  },

  requestReset: async (email) => {
    set({ busy: true, error: null, notice: null })
    try {
      await api('auth/reset', { body: { email } })
      set({ busy: false, notice: 'If that email has an account, a reset link is on its way.' })
    } catch (e) {
      set({ busy: false, error: message(e) })
    }
  },

  updatePassword: async (password) => {
    set({ busy: true, error: null, notice: null })
    try {
      await api('auth/password', { body: { password } })
      set({ busy: false, status: 'signedIn', notice: 'Password updated.' })
      await get().refreshMe()
    } catch (e) {
      set({ busy: false, error: message(e) })
    }
  },

  signOut: async () => {
    await api('auth/logout', { body: {} }).catch(() => {})
    // Reload so the board store, live stream and timers start clean for the next user.
    window.location.reload()
  },
}))

const LINK_ERRORS: Record<string, string> = {
  link_expired: 'That email link expired or was already used. Sign in, or register again to get a new one.',
  link_other_device: 'Open the email link in the same browser you registered or requested the reset from.',
  link_invalid: 'That email link did not work. Try again.',
}

/** Flags the BFF's /api/auth/callback put in the URL after an email link. Removed once read. */
function readLinkResult(): { confirmed: boolean; recovery: boolean; error: string | null } {
  const params = new URLSearchParams(window.location.search)
  const result = {
    confirmed: params.get('confirmed') === '1',
    recovery: params.get('recovery') === '1',
    error: params.get('auth_error') ? (LINK_ERRORS[params.get('auth_error')!] ?? LINK_ERRORS.link_invalid!) : null,
  }
  if (result.confirmed || result.recovery || result.error) window.history.replaceState(null, '', window.location.pathname)
  return result
}

let initialised = false
let approvalPoll: ReturnType<typeof setInterval> | null = null

/** Load the session from the BFF and handle email-link results. Call once on app start. */
export function initAuth() {
  if (initialised || backendMode !== 'bff') return
  initialised = true
  const link = readLinkResult()
  if (link.error) useAuth.setState({ error: link.error })
  if (link.recovery) useAuth.setState({ status: 'recovery' })

  void useAuth
    .getState()
    .refreshMe()
    .then(() => {
      if (link.confirmed && useAuth.getState().status === 'signedIn') {
        useStudio.getState().pushToast({ kind: 'info', title: 'Email confirmed', body: 'Welcome to Studio Slots!' })
      }
    })

  // While waiting for approval, re-check so approval lets the user in without a reload.
  useAuth.subscribe((s) => {
    const waiting = s.status === 'signedIn' && s.profileActive === false
    if (waiting && !approvalPoll) approvalPoll = setInterval(() => void useAuth.getState().checkProfile(), 10_000)
    if (!waiting && approvalPoll) {
      clearInterval(approvalPoll)
      approvalPoll = null
    }
  })
}
