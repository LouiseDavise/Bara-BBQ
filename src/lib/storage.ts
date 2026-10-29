// localStorage that never throws (private windows, blocked storage).

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage unavailable: the choice just isn't remembered.
  }
}

/** A long-lived, non-HttpOnly cookie the middleware can read (e.g. the chosen language). */
export function writeCookie(name: string, value: string, days = 365): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${days * 86_400}; SameSite=Lax`
}
