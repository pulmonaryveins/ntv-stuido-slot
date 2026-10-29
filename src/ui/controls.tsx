import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as RSelect from '@radix-ui/react-select'
import * as RPopover from '@radix-ui/react-popover'
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
          <Tooltip.Content sideOffset={6} collisionPadding={8} className={`${floatingClass} ss-pop max-w-64 px-2.5 py-1.5 text-xs leading-snug`}>
            {gate}
            <Tooltip.Arrow width={10} height={5} className="fill-black" />
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
  size = 'md',
}: {
  label: string
  value: T
  options: { value: T; label: ReactNode; title?: string; disabled?: boolean }[]
  onChange: (v: T) => void
  disabled?: boolean
  /** lg matches the 44px account button in the header. */
  size?: 'md' | 'lg'
}) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      disabled={disabled}
      onValueChange={(v) => v && onChange(v as T)}
      className={`inline-flex border-2 border-line bg-surface-2 shadow-[inset_0_2px_0_var(--lo)] ${size === 'lg' ? 'h-11 gap-1 p-1' : 'p-0.5'}`}
    >
      {options.map((o) => (
        <Tip key={o.value} content={o.title} side="bottom">
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          aria-label={o.title}
          disabled={o.disabled}
          className={`inline-flex items-center justify-center gap-1.5 font-semibold text-muted hover:text-ink data-[state=on]:bg-accent data-[state=on]:text-accent-ink data-[state=on]:shadow-[inset_0_-3px_0_var(--lip),inset_0_2px_0_rgba(255,255,255,0.28)] disabled:cursor-not-allowed disabled:opacity-40 ${
            size === 'lg' ? 'min-w-11 px-3 text-sm data-[state=on]:outline-2 data-[state=on]:outline-black' : 'px-2 py-0.5 text-xs'
          }`}
        >
          {o.label}
        </ToggleGroup.Item>
        </Tip>
      ))}
    </ToggleGroup.Root>
  )
}

export interface SelectOption<T extends string> {
  value: T
  label: string
  /** Optional leading element (icon, color dot). */
  icon?: ReactNode
}

/** Block-styled dropdown (Radix Select): keyboard, typeahead and screen-reader support built in. */
export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  disabled,
  title,
  size = 'md',
  className = '',
}: {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  /** Accessible name (the trigger has no visible label). */
  label: string
  disabled?: boolean
  title?: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const current = options.find((o) => o.value === value)
  return (
    <RSelect.Root value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <Tip content={title}>
      <RSelect.Trigger
        aria-label={label}
        className={`group inline-flex items-center justify-between gap-2 border-2 border-line bg-surface-2 text-left text-ink shadow-[inset_2px_2px_0_var(--hi),inset_-2px_-2px_0_var(--lo)] hover:brightness-110 data-[state=open]:border-accent disabled:cursor-not-allowed disabled:opacity-45 ${
          size === 'sm' ? 'min-w-24 px-2 py-0.5 text-sm' : 'min-w-36 px-2.5 py-1.5 text-sm'
        } ${className}`}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {current?.icon}
          <RSelect.Value />
        </span>
        <RSelect.Icon className="text-muted transition-transform group-data-[state=open]:rotate-180">
          <Chevron />
        </RSelect.Icon>
      </RSelect.Trigger>
      </Tip>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={4}
          className="px-panel z-50 max-h-[min(320px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden"
        >
          <RSelect.ScrollUpButton className="flex justify-center py-0.5 text-muted">
            <Chevron up />
          </RSelect.ScrollUpButton>
          <RSelect.Viewport className="p-1">
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer select-none items-center gap-2 py-1.5 pl-7 pr-3 text-sm text-ink outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-ink data-[state=checked]:font-semibold"
              >
                <RSelect.ItemIndicator className="absolute left-2 inline-flex">
                  <Check />
                </RSelect.ItemIndicator>
                {o.icon}
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
          <RSelect.ScrollDownButton className="flex justify-center py-0.5 text-muted">
            <Chevron />
          </RSelect.ScrollDownButton>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}

/** Pixel chevron (crisp at any zoom). */
function Chevron({ up }: { up?: boolean }) {
  return (
    <svg width="10" height="6" viewBox="0 0 5 3" shapeRendering="crispEdges" aria-hidden style={up ? { transform: 'rotate(180deg)' } : undefined}>
      <path fill="currentColor" d="M0 0h5v1H4v1H3v1H2V2H1V1H0z" />
    </svg>
  )
}

function Check() {
  return (
    <svg width="10" height="8" viewBox="0 0 5 4" shapeRendering="crispEdges" aria-hidden>
      <path fill="currentColor" d="M4 0h1v1H4v1H3v1H2v1H1V3H0V2h1v1h1V2h1V1h1z" />
    </svg>
  )
}

/** A user's color dot. */
export function Dot({ color }: { color: string }) {
  return <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} />
}

const floatingClass = 'on-dark z-50 border-2 border-black bg-[#1e1e1f] text-ink shadow-[inset_0_2px_0_rgba(255,255,255,0.12),4px_4px_0_rgba(0,0,0,0.35)]'

/** Hover/focus hint in the block style (replaces the browser's plain `title` tooltip). */
export function Tip({
  content,
  side = 'top',
  children,
}: {
  content: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactNode
}) {
  if (!content) return <>{children}</>
  return (
    <Tooltip.Root delayDuration={200}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side={side} sideOffset={6} collisionPadding={8} className={`${floatingClass} ss-pop max-w-64 px-2.5 py-1.5 text-xs leading-snug`}>
          {content}
          <Tooltip.Arrow width={10} height={5} className="fill-black" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

/** Click-to-open info card with an optional title; closes on outside click or Esc. */
export function Popover({
  trigger,
  title,
  children,
  side = 'bottom',
  align = 'start',
  width = 'w-72',
}: {
  trigger: ReactNode
  title?: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  width?: string
}) {
  return (
    <RPopover.Root>
      <RPopover.Trigger asChild>{trigger}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content side={side} align={align} sideOffset={8} collisionPadding={12} className={`${floatingClass} ss-pop ${width} p-3 text-sm`}>
          {title && (
            <div className="mb-2 flex items-center gap-2 border-b-2 border-black pb-2">
              <span className="font-pixel text-sm uppercase">{title}</span>
              <RPopover.Close aria-label="Close" className="ml-auto px-1 text-muted hover:text-ink">
                ✕
              </RPopover.Close>
            </div>
          )}
          <div className="text-muted [&_strong]:text-ink">{children}</div>
          <RPopover.Arrow width={12} height={6} className="fill-black" />
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  )
}

/** Small "?" block that opens a Popover with help text. */
export function InfoTip({ label, title, children }: { label: string; title?: ReactNode; children: ReactNode }) {
  return (
    <Popover
      title={title}
      trigger={
        <button
          type="button"
          aria-label={label}
          className="inline-grid size-5 shrink-0 place-items-center border-2 border-line bg-surface-2 align-middle text-[11px] font-bold leading-none text-muted hover:bg-accent hover:text-accent-ink"
        >
          ?
        </button>
      }
    >
      {children}
    </Popover>
  )
}
