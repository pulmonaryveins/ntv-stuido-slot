export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  const h = new Headers(headers)
  h.set('Content-Type', 'application/json; charset=utf-8')
  h.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(body), { status, headers: h })
}

/** Stable error shape: `{ error: code, message? }`. */
export function fail(code: string, status: number, message?: string): Response {
  return json(message ? { error: code, message } : { error: code }, status)
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

export interface CookieOptions {
  maxAge?: number
  path?: string
  secure: boolean
  sameSite?: 'Lax' | 'Strict'
}

export function serializeCookie(name: string, value: string, o: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${o.path ?? '/'}`, 'HttpOnly', `SameSite=${o.sameSite ?? 'Lax'}`]
  if (o.secure) parts.push('Secure')
  if (o.maxAge !== undefined) parts.push(`Max-Age=${o.maxAge}`)
  return parts.join('; ')
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    const text = await request.text()
    if (text.length > 16_384) return null
    return text ? (JSON.parse(text) as T) : ({} as T)
  } catch {
    return null
  }
}

/** Origin the browser used (for building email redirect links). */
export function requestOrigin(request: Request): string {
  const url = new URL(request.url)
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host
  return `${proto}://${host}`
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
