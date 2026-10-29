// Small Web Crypto helpers. Web Crypto only (no node:crypto), so this also runs in
// middleware.ts and the local dev server.

const encoder = new TextEncoder()

export function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

/** A URL-safe random token (32 bytes = 43 characters by default). */
export function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return toBase64Url(buffer)
}

const hex = (buffer: ArrayBuffer): string => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')

export async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
}

/** Compares strings without leaking where they differ through timing. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

type HmacKey = ReturnType<typeof crypto.subtle.importKey>
const keys = new Map<string, HmacKey>()

/** Imports each secret's HMAC key once instead of on every sign/verify. */
function hmacKey(secret: string): HmacKey {
  let key = keys.get(secret)
  if (!key) {
    key = crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    key.catch(() => keys.delete(secret))
    keys.set(secret, key)
  }
  return key
}

export async function hmacHex(secret: string, payload: string): Promise<string> {
  return hex(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload)))
}
