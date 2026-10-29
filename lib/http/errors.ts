// Errors a handler throws to send a specific status. Anything else becomes a 500.

export class HttpError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, 'bad_request', message, details)
export const unauthorized = (message = 'Please sign in.') => new HttpError(401, 'unauthorized', message)
export const forbidden = (message = 'You don’t have access to this.', code = 'forbidden') => new HttpError(403, code, message)
export const notFound = (message = 'Not found.') => new HttpError(404, 'not_found', message)
export const methodNotAllowed = () => new HttpError(405, 'method_not_allowed', 'Method not allowed.')
export const conflict = (message: string, code = 'conflict') => new HttpError(409, code, message)
export const unprocessable = (message: string, code = 'unprocessable') => new HttpError(422, code, message)
export const tooManyRequests = (message = 'Too many attempts. Please wait a few minutes and try again.') =>
  new HttpError(429, 'rate_limited', message)
