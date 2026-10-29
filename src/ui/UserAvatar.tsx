import { useMemo } from 'react'
import type { Profile } from '../data'
import { useStudio } from '../store/studio'
import { assignCharacters } from '../lib/characters'

/** Which portrait each user gets: the same random-but-stable pick as their 3D character. */
function usePortraitIndex() {
  const portraits = useStudio((s) => s.portraits)
  const profiles = useStudio((s) => s.snapshot?.profiles)
  return useMemo(
    () => (portraits && profiles ? assignCharacters(profiles, portraits.length) : null),
    [portraits, profiles],
  )
}

/**
 * Profile picture: the user's superhero character's head, framed as a block. Falls back to
 * their colour with an initial while portraits load (or if the character pack is missing).
 */
export function UserAvatar({
  profile,
  size = 20,
  className = '',
}: {
  profile: Pick<Profile, 'id' | 'name' | 'avatar_color'> | null | undefined
  size?: number
  className?: string
}) {
  const portraits = useStudio((s) => s.portraits)
  const index = usePortraitIndex()
  if (!profile) return null
  const i = index?.get(profile.id)
  const src = i !== undefined ? portraits?.[i] : undefined
  const style = { width: size, height: size, background: profile.avatar_color }
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
      {profile.name.slice(0, 1).toUpperCase()}
    </span>
  )
}
