/**
 * Authenticated encryption for cookie payloads (AES-256-GCM, Web Crypto).
 * Output: base64url(iv | ciphertext+tag). Tampered or foreign values fail to open.
 */
const keyCache = new Map<string, Promise<CryptoKey>>()

function key(secret: string): Promise<CryptoKey> {
  let k = keyCache.get(secret)
  if (!k) {
    k = crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(secret))
      .then((raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']))
    keyCache.set(secret, k)
  }
  return k
}

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url')
const fromB64url = (s: string) => new Uint8Array(Buffer.from(s, 'base64url'))

export async function seal(value: unknown, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(JSON.stringify(value))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret), data))
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv)
  out.set(ct, iv.length)
  return b64url(out)
}

export async function unseal<T>(token: string | undefined, secret: string): Promise<T | null> {
  if (!token) return null
  try {
    const raw = fromB64url(token)
    if (raw.length < 13) return null
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, await key(secret), raw.slice(12))
    return JSON.parse(new TextDecoder().decode(pt)) as T
  } catch {
    return null
  }
}
