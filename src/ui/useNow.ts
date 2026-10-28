import { useEffect, useState } from 'react'
import { studioClient } from '../data'

/** Current (mock or wall) time, re-rendering every `intervalMs` real milliseconds. */
export function useNow(intervalMs = 500): number {
  const [now, setNow] = useState(() => studioClient.now())
  useEffect(() => {
    const t = setInterval(() => setNow(studioClient.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
