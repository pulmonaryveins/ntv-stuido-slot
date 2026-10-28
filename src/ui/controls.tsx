import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as ToggleGroup from '@radix-ui/react-toggle-group'
import type { Gate } from '../lib/availability'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'px-btn bg-accent text-accent-ink hover:brightness-110',
  secondary: 'px-btn bg-surface-2 text-ink hover:brightness-105',
  ghost: 'border-2 border-transparent bg-transparent text-ink hover:border-line hover:bg-surface-2',
  danger: 'px-btn bg-overdue text-white hover:brightness-110',
}

export function buttonClass(variant: Variant = 'secondary', extra = '') {
  return `inline-flex items-center justify-center gap-1.5 px-2.5 py-1 text-sm font-semibold ${VARIANTS[variant]} ${extra}`
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
            className="z-50 max-w-60 border-2 border-line bg-ink px-2 py-1 text-xs text-bg"
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
      className="inline-flex border-[3px] border-line bg-surface-2 p-0.5"
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          title={o.title}
          aria-label={o.title}
          disabled={o.disabled}
          className="px-2 py-0.5 text-xs font-semibold text-muted data-[state=on]:bg-accent data-[state=on]:text-accent-ink data-[state=on]:shadow-[inset_2px_2px_0_var(--hi),inset_-2px_-2px_0_var(--lo)] disabled:opacity-40"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
