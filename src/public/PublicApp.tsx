// Public site routes. Phase 1 has only the language-aware placeholder; Phase 2 adds the brand
// and branch pages under /:lang/.
import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { isLocale, LOCALE_INFO, matchLocale, type Locale } from '../../shared/locales'
import { fill, type GuestMessages } from '../i18n/types'
import { loadLocaleFonts } from '../lib/fonts'
import { loadGuestMessages } from '../lib/messages'
import { readLocal, writeCookie, writeLocal } from '../lib/storage'
import { DemoRibbon } from '../common/DemoRibbon'
import { LanguagePicker } from './components/LanguagePicker'
import { StoedioCredit } from './components/StoedioCredit'
import { ComingSoon } from './pages/ComingSoon'

export const LANG_KEY = 'bara.lang'
export const LANG_COOKIE = 'bara_lang'

export function preferredLocale(): Locale {
  const saved = readLocal(LANG_KEY)
  if (isLocale(saved)) return saved
  return matchLocale(navigator.languages?.join(',') ?? navigator.language)
}

function LocaleGate() {
  const { lang } = useParams()
  const locale = isLocale(lang) ? lang : null
  const [messages, setMessages] = useState<{ locale: Locale; messages: GuestMessages } | null>(null)

  useEffect(() => {
    if (!locale) return
    let cancelled = false
    document.documentElement.lang = LOCALE_INFO[locale].htmlLang
    loadLocaleFonts(locale)
    writeLocal(LANG_KEY, locale)
    writeCookie(LANG_COOKIE, locale)
    void loadGuestMessages(locale).then((loaded) => {
      if (!cancelled) setMessages({ locale, messages: loaded })
    })
    return () => {
      cancelled = true
    }
  }, [locale])

  if (!locale) return <Navigate to={`/${preferredLocale()}/`} replace />
  if (!messages || messages.locale !== locale) return null
  const m = messages.messages

  return (
    <>
      <DemoRibbon m={m} />
      <header className="site-header">
        <a className="wordmark" href={`/${locale}/`}>
          Bara <span lang="zh-Hant">炭焰</span>
        </a>
        <LanguagePicker locale={locale} m={m} />
      </header>
      <main id="main">
        <ComingSoon locale={locale} m={m} />
      </main>
      <footer className="site-footer">
        <p>{fill(m.footer.rights, { year: new Date().getFullYear() })}</p>
        <StoedioCredit m={m} />
      </footer>
    </>
  )
}

export function PublicApp() {
  return (
    <Routes>
      <Route path="/:lang/*" element={<LocaleGate />} />
      <Route path="*" element={<Navigate to={`/${preferredLocale()}/`} replace />} />
    </Routes>
  )
}
