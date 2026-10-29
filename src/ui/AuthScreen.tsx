import { useEffect, useId, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { MIN_PASSWORD, useAuth } from '../store/auth'
import { api } from '../lib/backend'
import { InfoTip } from './controls'
import { PixelIcon, type IconName } from './PixelIcon'
import { Loader, Spinner } from './Loader'

type Mode = 'signin' | 'register' | 'forgot'

function Field({
  label,
  hint,
  error,
  extra,
  children,
}: {
  label: string
  hint?: ReactNode
  error?: string | null
  /** Shown beside the label (e.g. a help popover). */
  extra?: ReactNode
  children: (id: string, describedBy: string | undefined) => ReactNode
}) {
  const id = useId()
  const hintId = hint || error ? `${id}-hint` : undefined
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {extra}
      </div>
      {children(id, hintId)}
      {error ? (
        <p id={hintId} className="mt-1 text-xs text-overdue">
          {error}
        </p>
      ) : (
        hint && (
          <div id={hintId} className="mt-1 text-xs text-muted">
            {hint}
          </div>
        )
      )}
    </div>
  )
}

/** Text input with a leading pixel icon and an optional trailing control. */
function Input({
  icon,
  trailing,
  invalid,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { icon: IconName; trailing?: ReactNode; invalid?: boolean }) {
  return (
    <div
      className={`flex items-center border-2 bg-surface-2 shadow-[inset_2px_2px_0_var(--lo)] focus-within:border-accent ${
        invalid ? 'border-overdue' : 'border-line'
      }`}
    >
      <span aria-hidden className="grid w-10 shrink-0 place-items-center opacity-80">
        <PixelIcon name={icon} size={16} />
      </span>
      <input
        aria-invalid={invalid || undefined}
        className={`no-ring min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-sm text-ink outline-none placeholder:text-muted/60 ${className}`}
        {...props}
      />
      {trailing}
    </div>
  )
}

function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { invalid?: boolean }) {
  const [show, setShow] = useState(false)
  return (
    <Input
      {...props}
      icon="key"
      type={show ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="mr-1 px-2 py-1 text-xs font-semibold text-muted hover:text-ink"
        >
          {show ? 'Hide' : 'Show'}
        </button>
      }
    />
  )
}

/** Four-step meter: length plus a mix of letters, digits and symbols. */
function Strength({ password }: { password: string }) {
  if (!password) return null
  const score =
    (password.length >= MIN_PASSWORD ? 1 : 0) +
    (password.length >= 12 ? 1 : 0) +
    (/[a-z]/i.test(password) && /\d/.test(password) ? 1 : 0) +
    (/[^a-z0-9]/i.test(password) ? 1 : 0)
  const label = ['Too short', 'Weak', 'Okay', 'Good', 'Strong'][score]!
  const color = score <= 1 ? 'bg-overdue' : score === 2 ? 'bg-reserved' : 'bg-free'
  return (
    <div className="mt-1.5 flex items-center gap-2" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 flex-1 ${i < score ? color : 'bg-surface-2'}`} />
        ))}
      </div>
      <span className="w-16 text-right text-xs text-muted">{label}</span>
    </div>
  )
}

/** Illustration for the brand panel: the four seats as blocks. Decorative only. */
function SeatBlocks() {
  const seats = [
    { label: 'Account 1 · 1', state: 'In use', color: 'bg-[#e58f4b]', device: 'C1' },
    { label: 'Account 1 · 2', state: 'Free', color: 'bg-free', device: null },
    { label: 'Account 2 · 1', state: 'In use', color: 'bg-[#e58f4b]', device: 'D4' },
    { label: 'Account 2 · 2', state: 'Reserved', color: 'bg-reserved', device: null },
  ]
  return (
    <div aria-hidden className="grid grid-cols-2 gap-3">
      {seats.map((s) => (
        <div key={s.label} className="px-panel flex items-center gap-2.5 p-2.5">
          <span className={`px-btn size-8 shrink-0 ${s.color}`} />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-xs text-muted">{s.label}</div>
            <div className="text-sm font-semibold">
              {s.state}
              {s.device && <span className="ml-1.5 font-mono text-xs font-normal text-muted">{s.device}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'block', title: 'Claim a free seat', body: 'Pick a seat on the board and set when you will finish.' },
  { icon: 'key', title: 'Then sign in to Adobe', body: 'Only once your claim succeeds, so nobody gets kicked off.' },
  { icon: 'door', title: 'End your session', body: 'Sign out of Adobe and the next person in line gets the seat.' },
]

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="grid h-full overflow-y-auto lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside className="on-dark relative hidden flex-col justify-between overflow-hidden border-r-2 border-black bg-[#121213] p-10 lg:flex xl:p-14">
        <div className="flex items-center gap-3">
          <span aria-hidden className="px-btn grid size-11 place-items-center bg-accent">
            <PixelIcon name="brush" size={26} />
          </span>
          <span className="font-pixel text-xl font-semibold">Studio Slots</span>
        </div>

        <div className="max-w-lg">
          <h2 className="text-3xl leading-tight normal-case xl:text-4xl">
            Four Adobe seats.
            <br />
            <span className="text-accent">No more kicked-off sessions.</span>
          </h2>
          <p className="mt-3 text-muted">
            See who is on which seat and device, claim one before you sign in, and join the waiting list when they are
            all taken.
          </p>
          <div className="mt-8">
            <SeatBlocks />
          </div>
          <ol className="mt-8 space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="px-btn grid size-9 shrink-0 place-items-center bg-surface-2">
                  <PixelIcon name={s.icon} size={18} />
                </span>
                <div>
                  <p className="font-semibold">
                    <span className="mr-1.5 text-muted">{i + 1}.</span>
                    {s.title}
                  </p>
                  <p className="text-sm text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-xs text-muted">Never share or store Adobe passwords here.</p>
      </aside>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {/* Compact brand on small screens (the side panel is hidden there). */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span aria-hidden className="px-btn grid size-10 place-items-center bg-accent">
              <PixelIcon name="brush" size={24} />
            </span>
            <span className="font-pixel text-lg font-semibold">Studio Slots</span>
          </div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="px-panel mt-6 p-5 sm:p-6">{children}</div>
          <p className="mt-4 text-center text-xs text-muted lg:hidden">Never share or store Adobe passwords here.</p>
        </div>
      </section>
    </main>
  )
}

function Alert({ tone, children }: { tone: 'error' | 'ok'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2 border-2 px-3 py-2 text-sm ${
        tone === 'error' ? 'border-overdue/60 bg-overdue/10 text-overdue' : 'border-free/60 bg-free/10 text-free'
      }`}
    >
      <PixelIcon name={tone === 'error' ? 'warn' : 'check'} size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

function Messages() {
  const error = useAuth((s) => s.error)
  const errorField = useAuth((s) => s.errorField)
  const notice = useAuth((s) => s.notice)
  return (
    <>
      {/* Field errors (taken email / device) show under their field instead. */}
      {error && !errorField && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="ok">{notice}</Alert>}
    </>
  )
}

function Submit({ children }: { children: ReactNode }) {
  const busy = useAuth((s) => s.busy)
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className="px-btn w-full bg-accent px-3 py-2.5 font-semibold text-accent-ink hover:brightness-110 disabled:opacity-60"
    >
      {busy ? (
        <span className="inline-flex items-center gap-2">
          <Spinner size={14} /> Please wait…
        </span>
      ) : (
        children
      )}
    </button>
  )
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-sm text-muted underline underline-offset-2 hover:text-ink">
      {children}
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
    <Shell
      title={mode === 'signin' ? 'Welcome back' : 'Create your account'}
      subtitle={mode === 'signin' ? 'Sign in to see the seats and claim one.' : 'An admin approves new accounts before they can claim seats.'}
    >
      <Tabs.Root value={mode} onValueChange={(v) => go(v as Mode)}>
        <Tabs.List aria-label="Account" className="mb-5 grid grid-cols-2 gap-1 border-2 border-line bg-surface-2 p-1">
          {(['signin', 'register'] as const).map((m) => (
            <Tabs.Trigger
              key={m}
              value={m}
              className="px-3 py-2 text-sm text-muted hover:text-ink data-[state=active]:bg-accent data-[state=active]:text-accent-ink data-[state=active]:shadow-[inset_2px_2px_0_var(--hi),inset_-2px_-2px_0_var(--lo)]"
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
          <Input
            id={id}
            icon="mail"
            type="email"
            required
            autoComplete="email"
            placeholder="you@studio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <div>
        <Field label="Password">
          {(id) => (
            <PasswordInput id={id} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <div className="mt-1.5 text-right">
          <LinkButton onClick={onForgot}>Forgot password?</LinkButton>
        </div>
      </div>
      <Messages />
      <Submit>Sign in</Submit>
    </form>
  )
}

const DEVICE_RE = /^[A-Za-z0-9-]{1,15}$/

/** "?" popover next to the device name label. */
function DeviceHelp() {
  return (
    <InfoTip label="How do I find my device name?" title="Find your device name">
      <ol className="list-decimal space-y-1.5 pl-4 text-xs">
        <li>
          Open <strong className="text-ink">Settings › System › About</strong> and copy <strong className="text-ink">Device name</strong>.
        </li>
        <li>
          Or press <kbd className="border border-line bg-surface-2 px-1 font-mono">Win</kbd> +{' '}
          <kbd className="border border-line bg-surface-2 px-1 font-mono">R</kbd>, type <code className="font-mono text-ink">cmd</code>, then{' '}
          <code className="font-mono text-ink">hostname</code>.
        </li>
        <li>Adobe lists your computer under this name in its activated devices.</li>
      </ol>
    </InfoTip>
  )
}

function RegisterForm() {
  const signUp = useAuth((s) => s.signUp)
  const [name, setName] = useState('')
  const [deviceName, setDeviceName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [tried, setTried] = useState(false)
  const serverError = useAuth((s) => s.error)
  const errorField = useAuth((s) => s.errorField)
  const clearMessages = useAuth((s) => s.clearMessages)
  const [deviceTaken, setDeviceTaken] = useState<string | null>(null)

  // Ask the server whether the device name is free once they leave the field.
  const checkDevice = async () => {
    const name = deviceName.trim().toUpperCase()
    if (!DEVICE_RE.test(name)) return
    try {
      const res = await api<{ available: boolean }>('auth/check-device', { body: { deviceName: name } })
      setDeviceTaken(res.available ? null : name)
    } catch {
      /* the sign-up itself still checks */
    }
  }

  const deviceError =
    deviceName && !DEVICE_RE.test(deviceName.trim())
      ? 'Letters, numbers and dashes only, up to 15.'
      : deviceTaken && deviceTaken === deviceName.trim().toUpperCase()
        ? 'Already registered to another account.'
        : errorField === 'device'
          ? serverError
          : null
  const emailError = errorField === 'email' ? serverError : null
  const passwordError = tried && password.length < MIN_PASSWORD ? `At least ${MIN_PASSWORD} characters.` : null
  const confirmError = confirm && password !== confirm ? 'Passwords do not match.' : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (password.length < MIN_PASSWORD || password !== confirm || !DEVICE_RE.test(deviceName.trim()) || deviceError) return
    void signUp({ name: name.trim(), deviceName: deviceName.trim().toUpperCase(), email, password })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" hint="Shown to teammates.">
          {(id, d) => (
            <Input
              id={id}
              icon="user"
              aria-describedby={d}
              required
              maxLength={60}
              autoComplete="name"
              placeholder="Alex Cruz"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field label="Device name" error={deviceError} hint="Your PC's hostname." extra={<DeviceHelp />}>
          {(id, d) => (
            <Input
              id={id}
              icon="block"
              aria-describedby={d}
              required
              maxLength={15}
              autoComplete="off"
              spellCheck={false}
              placeholder="H7"
              invalid={!!deviceError}
              value={deviceName}
              onBlur={() => void checkDevice()}
              onChange={(e) => {
                setDeviceName(e.target.value.toUpperCase())
                if (errorField === 'device') clearMessages()
              }}
              className="font-mono uppercase"
            />
          )}
        </Field>
      </div>
      <Field label="Email" error={emailError}>
        {(id) => (
          <Input
            id={id}
            icon="mail"
            type="email"
            required
            autoComplete="email"
            placeholder="you@studio.com"
            invalid={!!emailError}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (errorField === 'email') clearMessages()
            }}
          />
        )}
      </Field>
      <Field label="Password" error={passwordError}>
        {(id, d) => (
          <>
            <PasswordInput
              id={id}
              aria-describedby={d}
              required
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              invalid={!!passwordError}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Strength password={password} />
          </>
        )}
      </Field>
      <Field label="Confirm password" error={confirmError}>
        {(id, d) => (
          <PasswordInput
            id={id}
            aria-describedby={d}
            required
            autoComplete="new-password"
            invalid={!!confirmError}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        )}
      </Field>
      <Messages />
      <Submit>Create account</Submit>
    </form>
  )
}

function ForgotScreen({ onBack }: { onBack: () => void }) {
  const requestReset = useAuth((s) => s.requestReset)
  const [email, setEmail] = useState('')
  return (
    <Shell title="Reset your password" subtitle="Enter your email and we will send you a reset link.">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void requestReset(email)
        }}
        className="space-y-4"
      >
        <Field label="Email">
          {(id) => (
            <Input
              id={id}
              icon="mail"
              type="email"
              required
              autoComplete="email"
              placeholder="you@studio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Messages />
        <Submit>Send reset link</Submit>
        <div className="text-center">
          <LinkButton onClick={onBack}>Back to sign in</LinkButton>
        </div>
      </form>
    </Shell>
  )
}

const RESEND_COOLDOWN_S = 60

function StatusIcon({ icon, tone }: { icon: IconName; tone: string }) {
  return (
    <span aria-hidden className={`px-btn mx-auto grid size-16 place-items-center ${tone}`}>
      <PixelIcon name={icon} size={34} />
    </span>
  )
}

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
        <StatusIcon icon="mail" tone="bg-accent/20" />
        <p className="text-sm">
          We sent a confirmation link to <strong className="break-all">{email}</strong>. Open it on this device to
          finish, then you are signed in automatically.
        </p>
        <p className="text-xs text-muted">Nothing there? Check spam or promotions.</p>
        {sent && <Alert tone="ok">Sent again.</Alert>}
        <Messages />
        <button
          type="button"
          onClick={() => void onResend()}
          disabled={wait > 0}
          className="px-btn w-full bg-surface-2 px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {wait > 0 ? `Resend email in ${wait}s` : 'Resend email'}
        </button>
        <LinkButton onClick={cancel}>Use a different email or sign in</LinkButton>
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
        <Field label="New password">
          {(id) => (
            <>
              <PasswordInput id={id} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Strength password={password} />
            </>
          )}
        </Field>
        <Field label="Confirm password">
          {(id) => (
            <PasswordInput id={id} required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          )}
        </Field>
        {local && <Alert tone="error">{local}</Alert>}
        <Messages />
        <Submit>Update password</Submit>
      </form>
    </Shell>
  )
}

/** Signed in but not active: new accounts wait for admin approval; deactivated accounts land here too. */
export function InactiveScreen() {
  const signOut = useAuth((s) => s.signOut)
  const email = useAuth((s) => s.email)
  return (
    <Shell title="Waiting for approval" subtitle={email ?? ''}>
      <div className="space-y-3 text-center">
        <StatusIcon icon="hourglass" tone="bg-reserved/20" />
        <p className="text-sm">An admin needs to approve your account before you can see the board and claim seats.</p>
        <p role="status" className="text-xs text-muted">
          This page lets you in automatically once you are approved.
        </p>
      </div>
      <button type="button" onClick={() => void signOut()} className="px-btn mt-5 w-full bg-surface-2 px-3 py-2 text-sm font-medium">
        Sign out
      </button>
    </Shell>
  )
}

export function LoadingScreen() {
  return (
    <main className="on-dark grid min-h-full place-items-center bg-bg" aria-busy="true">
      <Loader label="Loading Studio Slots" className="p-0" />
    </main>
  )
}
