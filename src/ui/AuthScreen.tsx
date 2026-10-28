import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import type { WorkRole } from '../data'
import { MIN_PASSWORD, useAuth } from '../store/auth'

type Mode = 'signin' | 'register' | 'forgot'

const WORK_ROLES: { value: WorkRole; label: string }[] = [
  { value: 'designer', label: 'Graphic designer' },
  { value: 'editor', label: 'Video editor' },
  { value: 'motion', label: 'Motion designer' },
]

const inputClass =
  'mt-1 block w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted/60'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children(id, hintId)}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  )
}

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="grid min-h-full place-items-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-5 text-center">
          <span aria-hidden className="mx-auto grid size-11 place-items-center rounded-xl bg-accent text-xl text-accent-ink">
            ◆
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">{children}</div>
        <p className="mt-4 text-center text-[11px] text-muted">Never share or store Adobe passwords here.</p>
      </div>
    </main>
  )
}

function Messages() {
  const error = useAuth((s) => s.error)
  const notice = useAuth((s) => s.notice)
  return (
    <>
      {error && (
        <p role="alert" className="rounded-lg bg-overdue/10 px-3 py-2 text-sm text-overdue">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-free/10 px-3 py-2 text-sm text-free">
          {notice}
        </p>
      )}
    </>
  )
}

function Submit({ children }: { children: ReactNode }) {
  const busy = useAuth((s) => s.busy)
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-105 disabled:opacity-60"
    >
      {busy ? 'Please wait…' : children}
    </button>
  )
}

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin')
  const clear = useAuth((s) => s.clearMessages)
  const go = (m: Mode) => {
    clear()
    setMode(m)
  }

  const pending = useAuth((s) => s.pendingEmail)
  if (pending) return <CheckEmailScreen email={pending} />
  if (mode === 'forgot') return <ForgotScreen onBack={() => go('signin')} />

  return (
    <Shell title="Studio Slots" subtitle="Claim an Adobe seat before you log in.">
      <Tabs.Root value={mode} onValueChange={(v) => go(v as Mode)}>
        <Tabs.List aria-label="Account" className="mb-4 grid grid-cols-2 rounded-lg border border-line bg-surface-2 p-0.5">
          {(['signin', 'register'] as const).map((m) => (
            <Tabs.Trigger
              key={m}
              value={m}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm"
            >
              {m === 'signin' ? 'Sign in' : 'Register'}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="signin">
          <SignInForm onForgot={() => go('forgot')} />
        </Tabs.Content>
        <Tabs.Content value="register">
          <RegisterForm />
        </Tabs.Content>
      </Tabs.Root>
    </Shell>
  )
}

function SignInForm({ onForgot }: { onForgot: () => void }) {
  const signIn = useAuth((s) => s.signIn)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void signIn(email, password)
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email">
        {(id) => (
          <input id={id} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        )}
      </Field>
      <Field label="Password">
        {(id) => (
          <input id={id} type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        )}
      </Field>
      <Messages />
      <Submit>Sign in</Submit>
      <button type="button" onClick={onForgot} className="block w-full text-center text-sm text-muted underline hover:text-ink">
        Forgot password?
      </button>
    </form>
  )
}

function RegisterForm() {
  const signUp = useAuth((s) => s.signUp)
  const [name, setName] = useState('')
  const [workRole, setWorkRole] = useState<WorkRole>('designer')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [local, setLocal] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return setLocal(`Password must be at least ${MIN_PASSWORD} characters.`)
    if (password !== confirm) return setLocal('Passwords do not match.')
    setLocal(null)
    void signUp({ name, workRole, email, password })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Your name" hint="Shown to teammates on the board.">
        {(id, d) => (
          <input id={id} aria-describedby={d} required maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        )}
      </Field>
      <Field label="What do you do?">
        {(id) => (
          <select id={id} value={workRole} onChange={(e) => setWorkRole(e.target.value as WorkRole)} className={inputClass}>
            {WORK_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Email">
        {(id) => (
          <input id={id} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        )}
      </Field>
      <Field label="Password" hint={`At least ${MIN_PASSWORD} characters.`}>
        {(id, d) => (
          <input id={id} aria-describedby={d} type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        )}
      </Field>
      <Field label="Confirm password">
        {(id) => (
          <input id={id} type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        )}
      </Field>
      {local && (
        <p role="alert" className="rounded-lg bg-overdue/10 px-3 py-2 text-sm text-overdue">
          {local}
        </p>
      )}
      <Messages />
      <Submit>Create account</Submit>
    </form>
  )
}

function ForgotScreen({ onBack }: { onBack: () => void }) {
  const requestReset = useAuth((s) => s.requestReset)
  const [email, setEmail] = useState('')
  return (
    <Shell title="Reset password" subtitle="We will email you a reset link.">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void requestReset(email)
        }}
        className="space-y-4"
      >
        <Field label="Email">
          {(id) => (
            <input id={id} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          )}
        </Field>
        <Messages />
        <Submit>Send reset link</Submit>
        <button type="button" onClick={onBack} className="block w-full text-center text-sm text-muted underline hover:text-ink">
          Back to sign in
        </button>
      </form>
    </Shell>
  )
}

const RESEND_COOLDOWN_S = 60

/** After registering with email confirmation on: tell the user to open the link. */
function CheckEmailScreen({ email }: { email: string }) {
  const resend = useAuth((s) => s.resendConfirmation)
  const cancel = useAuth((s) => s.cancelPending)
  const [wait, setWait] = useState(RESEND_COOLDOWN_S)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const onResend = async () => {
    setSent(false)
    if (await resend()) {
      setSent(true)
      setWait(RESEND_COOLDOWN_S)
    }
  }

  return (
    <Shell title="Check your email" subtitle="One more step to finish registering.">
      <div className="space-y-4 text-center">
        <span aria-hidden className="mx-auto grid size-14 place-items-center rounded-full bg-accent/15 text-2xl">
          ✉️
        </span>
        <p className="text-sm">
          We sent a confirmation link to <strong className="break-all">{email}</strong>. Open it on this device to
          finish, then you are signed in automatically.
        </p>
        <p className="text-xs text-muted">Nothing there? Check spam or promotions.</p>
        {sent && (
          <p role="status" className="rounded-lg bg-free/10 px-3 py-2 text-sm text-free">
            Sent again.
          </p>
        )}
        <Messages />
        <button
          type="button"
          onClick={() => void onResend()}
          disabled={wait > 0}
          className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {wait > 0 ? `Resend email in ${wait}s` : 'Resend email'}
        </button>
        <button type="button" onClick={cancel} className="block w-full text-center text-sm text-muted underline hover:text-ink">
          Use a different email or sign in
        </button>
      </div>
    </Shell>
  )
}

/** Shown after following a password-reset email link. */
export function NewPasswordScreen() {
  const updatePassword = useAuth((s) => s.updatePassword)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [local, setLocal] = useState<string | null>(null)
  return (
    <Shell title="Choose a new password" subtitle="Then you are back on the board.">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (password.length < MIN_PASSWORD) return setLocal(`Password must be at least ${MIN_PASSWORD} characters.`)
          if (password !== confirm) return setLocal('Passwords do not match.')
          setLocal(null)
          void updatePassword(password)
        }}
        className="space-y-4"
      >
        <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`}>
          {(id, d) => (
            <input id={id} aria-describedby={d} type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          )}
        </Field>
        <Field label="Confirm password">
          {(id) => (
            <input id={id} type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
          )}
        </Field>
        {local && (
          <p role="alert" className="rounded-lg bg-overdue/10 px-3 py-2 text-sm text-overdue">
            {local}
          </p>
        )}
        <Messages />
        <Submit>Update password</Submit>
      </form>
    </Shell>
  )
}

/** Signed in, but RLS shows nothing: the account was deactivated (or the profile is missing). */
export function InactiveScreen() {
  const signOut = useAuth((s) => s.signOut)
  const email = useAuth((s) => s.email)
  return (
    <Shell title="Account inactive" subtitle={email ?? ''}>
      <p className="text-sm">
        Your account is deactivated, so the board is hidden. Ask an admin to reactivate it, then sign in again.
      </p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-4 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium"
      >
        Sign out
      </button>
    </Shell>
  )
}

export function LoadingScreen() {
  return (
    <main className="grid min-h-full place-items-center text-sm text-muted" aria-busy="true">
      Loading…
    </main>
  )
}
