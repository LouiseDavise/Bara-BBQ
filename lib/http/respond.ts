// JSON responses. Firestore Timestamps become ISO strings on the way out.
import { HttpError } from './errors.js'

function isTimestamp(value: unknown): value is { toDate(): Date } {
  return typeof value === 'object' && value !== null && typeof (value as { toDate?: unknown }).toDate === 'function' && 'seconds' in value
}

/** JSON.stringify calls toJSON before the replacer, so look at the holder's original value. */
function replacer(this: Record<string, unknown>, key: string, value: unknown): unknown {
  const original = this[key]
  return isTimestamp(original) ? original.toDate().toISOString() : value
}

export interface JsonInit {
  status?: number
  headers?: Record<string, string>
  cookies?: string[]
  /** Cache-Control; API responses aren't cached unless a handler says so. */
  cache?: string
}

export function json(body: unknown, init: JsonInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', init.cache ?? 'no-store')
  for (const cookie of init.cookies ?? []) headers.append('Set-Cookie', cookie)
  return new Response(JSON.stringify(body, replacer), { status: init.status ?? 200, headers })
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, { status: error.status })
  }
  console.error('Unhandled API error:', error)
  return json({ error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } }, { status: 500 })
}
