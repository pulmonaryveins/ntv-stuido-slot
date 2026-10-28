export default function Stage({ active }: { active: boolean }) {
  return (
    <div className="grid h-full place-items-center bg-surface-2 text-sm text-muted" data-active={active}>
      3D studio coming soon.
    </div>
  )
}
