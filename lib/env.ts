// Typed access to environment variables. Server only.

export const isDemoMode = (): boolean => process.env.DEMO_MODE === 'true'

export const isProduction = (): boolean => process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'

/** Base URL for canonical links, QR codes and emails, without a trailing slash. */
export function appUrl(): string {
  return (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '')
}

/** HMAC secret for session and device cookies. There is deliberately no fallback value. */
export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be set to a random string of at least 32 characters.')
  return secret
}

/** Password session length in days, clamped to the 12–30 the brief allows (default 14). */
export function sessionDays(): number {
  const days = Number(process.env.SESSION_DAYS ?? 14)
  return Number.isFinite(days) ? Math.min(30, Math.max(12, Math.round(days))) : 14
}

export const cronSecret = (): string | null => process.env.CRON_SECRET || null

export const deployHookUrl = (): string | null => process.env.VERCEL_DEPLOY_HOOK_URL || null
