import { MockClock, MockStudioClient } from './mockClient'
import { SupabaseStudioClient } from './supabaseClient'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { StudioClient } from './types'

export * from './types'
export { MockClock, MockStudioClient }

/** Mock clock shared by the mock client and the speed control. */
export const mockClock = new MockClock(1)

/** Supabase when VITE_SUPABASE_URL/ANON_KEY are set, otherwise the in-memory mock. */
export const studioClient: StudioClient = supabaseConfigured
  ? new SupabaseStudioClient(supabase)
  : new MockStudioClient({ clock: mockClock, autoTick: true })

export const mockClient = studioClient instanceof MockStudioClient ? studioClient : null
