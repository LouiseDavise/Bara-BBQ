// Browser side of the API: JSON in and out, errors as ApiError, idempotency keys for writes
// that must never happen twice (orders, payments, invoices).

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** Reuse the same key when retrying the same action. */
  idempotencyKey?: string
  signal?: AbortSignal
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
  const response = await fetch(`/api${path}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'same-origin',
    signal: options.signal,
  })
  const data = (await response.json().catch(() => null)) as { error?: { code: string; message: string; details?: unknown } } | null
  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.code ?? 'http_error', data?.error?.message ?? response.statusText, data?.error?.details)
  }
  return data as T
}

/** A fresh key for one user action (create order, take payment, …). */
export const newIdempotencyKey = (): string => crypto.randomUUID().replaceAll('-', '')
