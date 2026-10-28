import { MockClock, MockStudioClient } from './mockClient'
import { BffStudioClient } from './bffClient'
import { backendMode } from '../lib/backend'
import type { StudioClient } from './types'

export * from './types'
export { MockClock, MockStudioClient }

/** Mock clock shared by the mock client and the speed control. */
export const mockClock = new MockClock(1)

/** The BFF (/api) when the server has Supabase configured, otherwise the in-memory mock. */
export const bffClient = backendMode === 'bff' ? new BffStudioClient() : null

export const studioClient: StudioClient = bffClient ?? new MockStudioClient({ clock: mockClock, autoTick: true })

export const mockClient = studioClient instanceof MockStudioClient ? studioClient : null
