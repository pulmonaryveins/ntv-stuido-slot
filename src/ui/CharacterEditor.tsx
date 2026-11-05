import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { Suspense, lazy, useState, type CSSProperties, type ReactNode } from 'react'
import type { Profile } from '../data'
import {
  ACCESSORIES,
  EYES,
  FACIAL_HAIR,
  GENDERS,
  HAIR,
  HAIR_STYLES,
  OUTFITS,
  PANTS,
  PRESETS,
  SHIRT,
  SHOES,
  SKIN,
  decodeLook,
  encodeLook,
  heroIndexOf,
  lookFromCode,
  randomCode,
  startingCode,
  type LookCode,
  type LookPart,
} from '../lib/look'
import { useStudio } from '../store/studio'
import { Button } from './controls'
import { PixelIcon, type IconName } from './PixelIcon'
import { UserAvatar } from './UserAvatar'
import { Spinner } from './Loader'
import { BlockFace, OutfitThumb } from './BlockFace'
import type { PreviewPose } from '../scene/CharacterPreview'

const CharacterPreview = lazy(() => import('../scene/CharacterPreview'))

type Mode = 'heroes' | 'build'
type Category = 'body' | 'hair' | 'face' | 'outfit' | 'extras'

const CATEGORIES: { id: Category; label: string; icon: IconName }[] = [
  { id: 'body', label: 'Body', icon: 'user' },
  { id: 'hair', label: 'Hair', icon: 'brush' },
  { id: 'face', label: 'Face', icon: 'sparkle' },
  { id: 'outfit', label: 'Outfit', icon: 'palette' },
  { id: 'extras', label: 'Extras', icon: 'key' },
]
const POSES: { id: PreviewPose; label: string }[] = [
  { id: 'idle', label: 'Idle' },
  { id: 'walk', label: 'Walk' },
  { id: 'wave', label: 'Wave' },
]

const rise = (i: number): CSSProperties => ({ ['--d' as string]: `${40 + i * 35}ms` })

/** "Your character": pick a hero from the pack or build a block character. */
export function CharacterEditor() {
  const open = useStudio((s) => s.customizeOpen)
  const setOpen = useStudio((s) => s.openCustomize)
  const snapshot = useStudio((s) => s.snapshot)
  const actorId = useStudio((s) => s.actorId)
  const me = snapshot?.profiles.find((p) => p.id === actorId)
  return (
    <Dialog.Root open={open && !!me} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="ss-overlay fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="ss-dialog fixed left-1/2 top-1/2 z-50 max-h-[94vh] w-[min(96vw,860px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto px-panel p-0 text-ink shadow-[inset_0_2px_0_var(--hi),6px_6px_0_rgba(0,0,0,0.35)]">
          {/* Remounted on every open so the draft starts from the saved character. */}
          {me && snapshot && open && <Editor key={me.id} me={me} profiles={snapshot.profiles} onDone={() => setOpen(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Editor({ me, profiles, onDone }: { me: Profile; profiles: Profile[]; onDone: () => void }) {
  const available = useStudio((s) => s.charactersAvailable)
  const portraits = useStudio((s) => s.portraits)
  const webgl = useStudio((s) => s.webgl)
  const act = useStudio((s) => s.act)
  const pushToast = useStudio((s) => s.pushToast)
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const saved = me.character
  const savedCode = saved ? decodeLook(saved) : null
  const [draft, setDraft] = useState<string | null>(saved)
  const [code, setCode] = useState<LookCode>(savedCode ?? startingCode(me))
  const [history, setHistory] = useState<LookCode[]>([])
  const [mode, setMode] = useState<Mode>(savedCode || !available ? 'build' : 'heroes')
  const [category, setCategory] = useState<Category>('body')
  const [pose, setPose] = useState<PreviewPose>('idle')
  const [saving, setSaving] = useState(false)

  const apply = (next: LookCode) => {
    setHistory((h) => [...h.slice(-29), code])
    setCode(next)
    setDraft(encodeLook(next))
  }
  const setPart = (part: LookPart, value: number) => {
    if (code[part] !== value) apply({ ...code, [part]: value })
  }
  const undo = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    setCode(prev)
    setDraft(encodeLook(prev))
  }
  const switchMode = (m: Mode) => {
    setMode(m)
    // Entering the builder shows the custom character straight away.
    if (m === 'build') setDraft(encodeLook(code))
    else if (draft && decodeLook(draft)) setDraft(saved && !decodeLook(saved) ? saved : null)
  }
  const save = async () => {
    setSaving(true)
    const ok = await act((c) => c.setMyCharacter(draft))
    setSaving(false)
    if (ok) {
      pushToast({ kind: 'info', title: 'New look saved', body: 'Everyone in the studio sees it now.' })
      onDone()
    }
  }
  const heroSelected = heroIndexOf(draft)
  /** The current build with one part changed, for option thumbnails. */
  const variant = (part: LookPart, i: number) => lookFromCode({ ...code, [part]: i })

  return (
    <div className="grid md:grid-cols-[300px_1fr]">
      {/* ------------------------------------------------ preview */}
      <div className="ss-banner relative flex flex-col border-b-2 border-line md:border-b-0 md:border-r-2" style={{ backgroundColor: me.avatar_color }}>
        <div className="flex items-center justify-between p-3">
          <Dialog.Title className="ss-rise border-2 border-black bg-black/55 px-2 py-0.5 text-sm text-white">Your character</Dialog.Title>
          <Dialog.Close className="px-btn grid size-8 place-items-center bg-surface-2 md:hidden" aria-label="Close">
            <PixelIcon name="close" size={12} />
          </Dialog.Close>
        </div>
        <div className="relative h-64 md:h-auto md:min-h-80 md:flex-1">
          {webgl ? (
            <Suspense fallback={<div className="grid h-full place-items-center"><Spinner /></div>}>
              <CharacterPreview profile={me} profiles={profiles} draft={draft} heroes={available} pose={pose} reducedMotion={reducedMotion} />
            </Suspense>
          ) : (
            <div className="grid h-full place-items-center">
              <UserAvatar profile={me} override={draft} size={150} />
            </div>
          )}
          {webgl && (
            <span className="font-pixel pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/45 px-1.5 py-0.5 text-[10px] uppercase text-white/80">
              Drag to turn
            </span>
          )}
        </div>
        {webgl && (
          <div role="radiogroup" aria-label="Pose" className="flex justify-center gap-1 px-3 pb-2">
            {POSES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={pose === p.id}
                onClick={() => setPose(p.id)}
                className={`px-btn px-2.5 py-0.5 text-xs ${pose === p.id ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 border-t-2 border-black bg-black/45 p-2.5 text-white">
          <UserAvatar profile={me} override={draft} size={38} />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">{me.name}</div>
            <div className="font-pixel text-[10px] uppercase text-white/75">
              {draft === null ? 'Automatic' : heroSelected !== null ? `Hero ${heroSelected + 1}` : `Custom · ${GENDERS[code.gender] ?? ''}`}
              {draft !== saved && ' · unsaved'}
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ controls */}
      <div className="flex min-w-0 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <Dialog.Description className="text-sm text-muted">Pick a hero or build your own block character. Everyone sees it in the studio and next to your name.</Dialog.Description>
          <Dialog.Close className="px-btn hidden size-8 shrink-0 place-items-center bg-surface-2 md:grid" aria-label="Close">
            <PixelIcon name="close" size={12} />
          </Dialog.Close>
        </div>

        <Tabs.Root value={mode} onValueChange={(v) => switchMode(v as Mode)} className="mt-3 flex min-h-0 flex-1 flex-col">
          <Tabs.List aria-label="Character type" className="grid grid-cols-2 gap-1 border-2 border-line bg-surface-2 p-1">
            {(
              [
                ['heroes', 'Heroes', !available],
                ['build', 'Build your own', false],
              ] as const
            ).map(([value, label, disabled]) => (
              <Tabs.Trigger
                key={value}
                value={value}
                disabled={disabled}
                className="px-3 py-2 text-sm text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 data-[state=active]:bg-accent data-[state=active]:text-accent-ink data-[state=active]:shadow-[inset_0_-3px_0_var(--lip),inset_0_2px_0_rgba(255,255,255,0.28)]"
              >
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* ---------------- heroes */}
          <Tabs.Content value="heroes" className="mt-3 outline-none">
            <div role="radiogroup" aria-label="Hero" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              <Choice selected={draft === null} onSelect={() => setDraft(null)} label="Automatic: a random hero that stays yours" style={rise(0)}>
                <span className="grid size-full place-items-center bg-surface-2 font-pixel text-[11px] uppercase leading-tight text-muted">
                  Auto
                  <PixelIcon name="sparkle" size={14} />
                </span>
              </Choice>
              {portraits
                ? portraits.map((src, i) => (
                    <Choice key={i} selected={heroSelected === i} onSelect={() => setDraft(`hero:${i}`)} label={`Hero ${i + 1}`} style={rise(1 + i)}>
                      <img src={src} alt="" draggable={false} className="size-full object-cover [image-rendering:pixelated]" />
                    </Choice>
                  ))
                : Array.from({ length: 11 }, (_, i) => <span key={i} className="ss-skeleton aspect-square border-2 border-line" />)}
            </div>
            <p className="mt-3 text-xs text-muted">Heroes can repeat: two people may pick the same one.</p>
          </Tabs.Content>

          {/* ---------------- builder */}
          <Tabs.Content value="build" className="mt-3 flex flex-col gap-3 outline-none">
            <section aria-label="Quick looks">
              <h3 className="mb-1.5 text-xs text-muted">Quick looks</h3>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {PRESETS.map((p, i) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => apply(p.code)}
                    style={rise(i)}
                    className="ss-rise flex shrink-0 flex-col items-center gap-1 border-2 border-line bg-surface-2 p-1.5 shadow-[inset_0_2px_0_var(--hi),inset_0_-3px_0_var(--lo)] transition-transform hover:-translate-y-0.5"
                  >
                    <BlockFace look={lookFromCode(p.code)} size={40} />
                    <span className="font-pixel text-[10px] uppercase">{p.name}</span>
                  </button>
                ))}
              </div>
            </section>

            <Tabs.Root value={category} onValueChange={(v) => setCategory(v as Category)}>
              <Tabs.List aria-label="Part" className="flex gap-1 border-b-2 border-line">
                {CATEGORIES.map((c) => (
                  <Tabs.Trigger
                    key={c.id}
                    value={c.id}
                    className="-mb-0.5 flex items-center gap-1.5 border-2 border-b-0 border-transparent px-2.5 py-1.5 text-xs text-muted hover:text-ink data-[state=active]:border-line data-[state=active]:bg-surface-2 data-[state=active]:text-ink"
                  >
                    <PixelIcon name={c.icon} size={12} />
                    <span className="hidden sm:inline">{c.label}</span>
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              <div className="min-h-64 pt-3">
                <Tabs.Content value="body" className="space-y-3 outline-none">
                  <Row label="Gender" i={0}>
                    {GENDERS.map((g, i) => (
                      <Option key={g} label={g} selected={code.gender === i} onSelect={() => setPart('gender', i)}>
                        <BlockFace look={variant('gender', i)} size={44} />
                      </Option>
                    ))}
                  </Row>
                  <p className="ss-rise -mt-1 text-xs text-muted" style={rise(1)}>
                    Female uses slim arms, lashes and lips. Everything else can be mixed freely.
                  </p>
                  <Swatches label="Skin" colors={SKIN} value={code.skin} onPick={(i) => setPart('skin', i)} i={2} />
                </Tabs.Content>

                <Tabs.Content value="hair" className="space-y-3 outline-none">
                  <Row label="Style" i={0}>
                    {HAIR_STYLES.map((s, i) => (
                      <Option key={s} label={s} selected={code.hairStyle === i} onSelect={() => setPart('hairStyle', i)}>
                        <BlockFace look={variant('hairStyle', i)} size={44} />
                      </Option>
                    ))}
                  </Row>
                  <Swatches label="Colour" colors={HAIR} value={code.hair} onPick={(i) => setPart('hair', i)} i={1} />
                </Tabs.Content>

                <Tabs.Content value="face" className="space-y-3 outline-none">
                  <Swatches label="Eyes" colors={EYES} value={code.eyes} onPick={(i) => setPart('eyes', i)} i={0} />
                  <Row label="Facial hair" i={1}>
                    {FACIAL_HAIR.map((s, i) => (
                      <Option key={s} label={s} selected={code.facialHair === i} onSelect={() => setPart('facialHair', i)}>
                        <BlockFace look={variant('facialHair', i)} size={44} />
                      </Option>
                    ))}
                  </Row>
                </Tabs.Content>

                <Tabs.Content value="outfit" className="space-y-3 outline-none">
                  <Row label="Style" i={0}>
                    {OUTFITS.map((s, i) => (
                      <Option key={s} label={s} selected={code.outfit === i} onSelect={() => setPart('outfit', i)}>
                        <span className="grid size-11 place-items-center bg-surface">
                          <OutfitThumb look={variant('outfit', i)} height={38} />
                        </span>
                      </Option>
                    ))}
                  </Row>
                  <Swatches label={code.outfit === 3 ? 'Shirt (under the overalls)' : code.outfit === 5 ? 'Tie' : 'Top'} colors={SHIRT} value={code.shirt} onPick={(i) => setPart('shirt', i)} i={1} />
                  <Swatches label={code.outfit === 3 ? 'Overalls' : code.outfit === 5 ? 'Suit' : 'Pants'} colors={PANTS} value={code.pants} onPick={(i) => setPart('pants', i)} i={2} />
                  <Swatches label="Shoes" colors={SHOES} value={code.shoes} onPick={(i) => setPart('shoes', i)} i={3} />
                </Tabs.Content>

                <Tabs.Content value="extras" className="space-y-3 outline-none">
                  <Row label="Accessory" i={0}>
                    {ACCESSORIES.map((s, i) => (
                      <Option key={s} label={s} selected={code.accessory === i} onSelect={() => setPart('accessory', i)}>
                        {/* The ID badge hangs on the chest, so show the outfit rather than the face. */}
                        {s === 'ID badge' ? (
                          <span className="grid size-11 place-items-center bg-surface">
                            <OutfitThumb look={variant('accessory', i)} height={38} />
                          </span>
                        ) : (
                          <BlockFace look={variant('accessory', i)} size={44} />
                        )}
                      </Option>
                    ))}
                  </Row>
                  <p className="ss-rise text-xs text-muted" style={rise(1)}>
                    Beanies and caps take your top colour; the ID badge goes over any outfit.
                  </p>
                </Tabs.Content>
              </div>
            </Tabs.Root>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => apply(randomCode())}>
                <PixelIcon name="dice" size={14} />
                Randomize
              </Button>
              <Button onClick={undo} disabled={!history.length}>
                <PixelIcon name="undo" size={14} />
                Undo
              </Button>
            </div>
          </Tabs.Content>
        </Tabs.Root>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t-2 border-line pt-3">
          {saved !== null && (
            <button type="button" onClick={() => setDraft(null)} className="mr-auto text-xs text-muted underline hover:text-ink">
              Back to automatic
            </button>
          )}
          <Dialog.Close asChild>
            <Button>Cancel</Button>
          </Dialog.Close>
          <Button variant="primary" disabled={saving || draft === saved} onClick={() => void save()}>
            {saving ? <Spinner /> : <PixelIcon name="check" size={14} />}
            Save look
          </Button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, i, children }: { label: string; i: number; children: ReactNode }) {
  return (
    <fieldset className="ss-rise" style={rise(i)}>
      <legend className="mb-1.5 text-xs text-muted">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {children}
      </div>
    </fieldset>
  )
}

/** A picture option (face or outfit thumbnail) with its name under it. */
function Option({ label, selected, onSelect, children }: { label: string; selected: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-16 flex-col items-center gap-1 border-2 p-1 transition-transform hover:-translate-y-0.5 ${
        selected ? 'border-black bg-accent text-accent-ink shadow-[inset_0_-3px_0_var(--lip)]' : 'border-line bg-surface-2 text-ink shadow-[inset_0_2px_0_var(--hi),inset_0_-3px_0_var(--lo)]'
      }`}
    >
      {children}
      <span className="font-pixel w-full truncate text-center text-[10px] uppercase leading-none">{label}</span>
    </button>
  )
}

function Swatches({ label, colors, value, onPick, i }: { label: string; colors: readonly string[]; value: number; onPick: (i: number) => void; i: number }) {
  return (
    <fieldset className="ss-rise" style={rise(i)}>
      <legend className="mb-1.5 text-xs text-muted">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {colors.map((c, idx) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === idx}
            aria-label={`${label} ${idx + 1}`}
            onClick={() => onPick(idx)}
            className="relative size-7 border-2 border-black shadow-[inset_0_2px_0_rgba(255,255,255,0.35),inset_0_-3px_0_rgba(0,0,0,0.25)] transition-transform hover:-translate-y-0.5 aria-checked:outline-3 aria-checked:outline-offset-1 aria-checked:outline-accent"
            style={{ background: c }}
          >
            {value === idx && (
              <span className="absolute inset-0 grid place-items-center text-white [filter:drop-shadow(1px_1px_0_#000)]">
                <PixelIcon name="check" size={12} />
              </span>
            )}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function Choice({ selected, onSelect, label, style, children }: { selected: boolean; onSelect: () => void; label: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onSelect}
      style={style}
      className="ss-rise relative aspect-square overflow-hidden border-2 border-black bg-surface-2 shadow-[3px_3px_0_rgba(0,0,0,0.3)] transition-transform hover:-translate-y-0.5 aria-checked:outline-3 aria-checked:outline-offset-1 aria-checked:outline-accent"
    >
      {children}
      {selected && (
        <span className="absolute right-0.5 top-0.5 grid size-4 place-items-center border border-black bg-accent text-white">
          <PixelIcon name="check" size={10} />
        </span>
      )}
    </button>
  )
}
