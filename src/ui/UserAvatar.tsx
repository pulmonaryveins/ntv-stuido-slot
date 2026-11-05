import { useMemo } from 'react'
import type { Profile } from '../data'
import { useStudio } from '../store/studio'
import { assignCharacters } from '../lib/characters'
import { resolveCharacter } from '../lib/look'
import { BlockFace } from './BlockFace'

/** Which portrait each user gets automatically: the same random-but-stable pick as their 3D character. */
function usePortraitIndex() {
  const portraits = useStudio((s) => s.portraits)
  const profiles = useStudio((s) => s.snapshot?.profiles)
  return useMemo(
    () => (portraits && profiles ? assignCharacters(profiles, portraits.length) : null),
    [portraits, profiles],
  )
}

type AvatarProfile = Pick<Profile, 'id' | 'name' | 'avatar_color'> & Partial<Pick<Profile, 'work_role' | 'character'>>

/**
 * Profile picture matching the user's 3D character: their hero's head (from the character pack),
 * or a pixel face for a blocky / custom character. Falls back to their colour with an initial
 * while hero portraits load. `override` previews a character code (the customization editor).
 */
export function UserAvatar({
  profile,
  size = 20,
  className = '',
  override,
}: {
  profile: AvatarProfile | null | undefined
  size?: number
  className?: string
  /** Character code to show instead of the saved one (undefined = saved). */
  override?: string | null
}) {
  const portraits = useStudio((s) => s.portraits)
  const available = useStudio((s) => s.charactersAvailable)
  // Callers may pass a partial profile (e.g. the top bar); the board has the full one.
  const full = useStudio((s) => (profile ? s.snapshot?.profiles.find((p) => p.id === profile.id) : undefined))
  const index = usePortraitIndex()
  if (!profile) return null
  const base = { work_role: 'designer' as const, character: null, ...profile, ...full }
  const p = override !== undefined ? { ...base, character: override } : base
  // While the pack is loading, heroes are expected: show the initial rather than a face that swaps.
  const heroCount = portraits?.length ?? (available ? 1 : 0)
  const ch = resolveCharacter(p, heroCount, index?.get(p.id) ?? (available ? 0 : undefined))
  const style = { width: size, height: size, background: p.avatar_color }

  if (ch.kind === 'blocky') return <BlockFace look={ch.look} size={size} className={className} background={p.avatar_color} />
  const src = portraits?.[ch.index]
  return src ? (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className={`inline-block shrink-0 border-2 border-black object-cover [image-rendering:pixelated] ${className}`}
      style={style}
    />
  ) : (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center border-2 border-black font-bold leading-none text-white ${className}`}
      style={{ ...style, fontSize: Math.max(9, size * 0.45) }}
    >
      {p.name.slice(0, 1).toUpperCase()}
    </span>
  )
}
