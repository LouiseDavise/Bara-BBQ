// Session, language and theme for the staff app.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isStaffLocale, matchLocale, STAFF_LOCALES, LOCALE_INFO, type StaffLocale } from '../../shared/locales'
import type { StaffMessages } from '../i18n/types'
import { api, ApiError } from '../lib/api'
import { loadLocaleFonts } from '../lib/fonts'
import { loadStaffMessages } from '../lib/messages'
import { readLocal, writeLocal } from '../lib/storage'
import type { MeResponse } from './types'

// ── Session ──────────────────────────────────────────────────────────────────────────

type SessionState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; me: MeResponse }

interface SessionValue {
  session: SessionState
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: 'loading' })

  const refresh = useCallback(async () => {
    try {
      setSession({ status: 'signedIn', me: await api<MeResponse>('/auth/me') })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setSession({ status: 'signedOut' })
      else throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' })
    setSession({ status: 'signedOut' })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(() => ({ session, refresh, signOut }), [session, refresh, signOut])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession() needs <SessionProvider>.')
  return value
}

// ── Language ─────────────────────────────────────────────────────────────────────────

const LANG_KEY = 'bara.staffLang'

interface I18nValue {
  locale: StaffLocale
  m: StaffMessages
  setLocale: (locale: StaffLocale) => void
}

const I18nContext = createContext<I18nValue | null>(null)

function initialLocale(): StaffLocale {
  const saved = readLocal(LANG_KEY)
  if (isStaffLocale(saved)) return saved
  const match = matchLocale(navigator.languages?.join(',') ?? navigator.language, STAFF_LOCALES)
  return isStaffLocale(match) ? match : 'en'
}

/** The signed-in user's language wins; before sign-in, the device's choice or the browser's. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { session } = useSession()
  const [locale, setLocaleState] = useState<StaffLocale>(initialLocale)
  const [loaded, setLoaded] = useState<{ locale: StaffLocale; m: StaffMessages } | null>(null)

  const userLanguage = session.status === 'signedIn' ? session.me.user.language : null
  useEffect(() => {
    if (userLanguage) setLocaleState(userLanguage)
  }, [userLanguage])

  useEffect(() => {
    let cancelled = false
    document.documentElement.lang = LOCALE_INFO[locale].htmlLang
    loadLocaleFonts(locale, { serif: false })
    void loadStaffMessages(locale).then((m) => {
      if (!cancelled) setLoaded({ locale, m })
    })
    return () => {
      cancelled = true
    }
  }, [locale])

  const setLocale = useCallback((next: StaffLocale) => {
    writeLocal(LANG_KEY, next)
    setLocaleState(next)
  }, [])

  const value = useMemo(() => (loaded ? { locale: loaded.locale, m: loaded.m, setLocale } : null), [loaded, setLocale])
  if (!value) return null
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n() needs <I18nProvider>.')
  return value
}

// ── Theme ────────────────────────────────────────────────────────────────────────────

export type Theme = 'dark' | 'light'

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'))
  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next
    writeLocal('bara.theme', next)
    setThemeState(next)
  }, [])
  return [theme, setTheme]
}

// ── Clock ────────────────────────────────────────────────────────────────────────────

/** The current time, refreshed every `intervalMs`. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
