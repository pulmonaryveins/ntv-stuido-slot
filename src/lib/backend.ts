/**
 * 'bff': the app talks only to its own /api (Supabase stays server-side).
 * 'mock': no backend configured, in-memory demo data. Decided at build time (vite.config.ts).
 */
export const backendMode: 'bff' | 'mock' = import.meta.env.VITE_BACKEND === 'bff' ? 'bff' : 'mock'

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, status: number, message?: string) {
    super(message ?? code)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

/** Fetch an /api endpoint with the session cookie and CSRF header. Throws ApiError on failure. */
export async function api<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? (init.body === undefined ? 'GET' : 'POST')
  let res: Response
  try {
    res = await fetch(`/api/${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(method === 'POST' ? { 'Content-Type': 'application/json', 'x-studio-csrf': '1' } : {}),
      },
      body: method === 'POST' ? JSON.stringify(init.body ?? {}) : undefined,
    })
  } catch {
    throw new ApiError('network', 0, 'Cannot reach the server. Check your connection.')
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
  if (!res.ok) throw new ApiError(data.error ?? 'unknown', res.status, data.message)
  return data as T
}
