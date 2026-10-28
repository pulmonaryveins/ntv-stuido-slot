import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as ToggleGroup from '@radix-ui/react-toggle-group'
import type { Gate } from '../lib/availability'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-105 border-transparent',
  secondary: 'bg-surface-2 text-ink border-line hover:border-muted',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-surface-2',
  danger: 'bg-transparent text-overdue border-overdue/50 hover:bg-overdue/10',
}

export function buttonClass(variant: Variant = 'secondary', extra = '') {
  return `inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors ${VARIANTS[variant]} ${extra}`
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />
}

/**
 * Button gated by a rule. When `gate` is a reason string the button stays focusable
 * (aria-disabled), looks disabled, and explains why in a tooltip and to screen readers.
 */
export function GateButton({
  gate,
  onClick,
  variant = 'secondary',
  className = '',
  children,
}: {
  gate: Gate
  onClick: () => void
  variant?: Variant
  className?: string
  children: ReactNode
}) {
  const reasonId = useId()
  const disabled = gate !== null
  const button = (
    <button
      type="button"
      aria-disabled={disabled || undefined}
      aria-describedby={disabled ? reasonId : undefined}
      onClick={disabled ? undefined : onClick}
      className={buttonClass(variant, `${className} ${disabled ? 'cursor-not-allowed opacity-45' : ''}`)}
    >
      {children}
    </button>
  )
  if (!disabled) return button
  return (
    <>
      <Tooltip.Root delayDuration={150}>
        <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="z-50 max-w-60 rounded-md bg-ink px-2 py-1 text-xs text-bg shadow-lg"
          >
            {gate}
            <Tooltip.Arrow className="fill-ink" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <span id={reasonId} className="sr-only">
        {gate}
      </span>
    </>
  )
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: T
  options: { value: T; label: ReactNode; title?: string; disabled?: boolean }[]
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      disabled={disabled}
      onValueChange={(v) => v && onChange(v as T)}
      className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5"
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          title={o.title}
          aria-label={o.title}
          disabled={o.disabled}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-sm disabled:opacity-40"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
