// The header on every signed-in screen: branch (with switcher), local time, user, language,
// theme, and lock or sign out.
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { pickText } from '../../../shared/localized'
import { LOCALE_INFO, STAFF_LOCALES, type StaffLocale } from '../../../shared/locales'
import { api } from '../../lib/api'
import { useI18n, useNow, useSession, useTheme } from '../context'
import type { MeResponse } from '../types'

export function StaffHeader({ me, title, branchId, timeZone }: { me: MeResponse; title: ReactNode; branchId?: string; timeZone?: string }) {
  const { m, locale, setLocale } = useI18n()
  const { signOut, refresh } = useSession()
  const [theme, setTheme] = useTheme()
  const navigate = useNavigate()
  const now = useNow()
  const branches = me.user.branches

  const changeLanguage = async (next: StaffLocale) => {
    setLocale(next)
    await api('/auth/me', { method: 'PATCH', body: { language: next } })
    await refresh()
  }

  const leave = async () => {
    await signOut()
    navigate(me.device ? '/lock' : '/login', { replace: true })
  }

  return (
    <header className="staff-header">
      <div className="staff-header-branch">
        <span className="wordmark small">Bara</span>
        <strong>{title}</strong>
        {timeZone && (
          <span className="muted">
            {m.shell.localTime}{' '}
            {new Intl.DateTimeFormat(LOCALE_INFO[locale].intl, { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now)}
          </span>
        )}
      </div>
      <div className="staff-header-tools">
        {branchId && branches.length > 1 && !me.device && (
          <label>
            <span className="visually-hidden">{m.shell.switchBranch}</span>
            <select value={branchId} onChange={(e) => navigate(`/staff/${e.target.value}`)}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {pickText(b.city, locale)} · {b.code}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className="visually-hidden">{m.shell.language}</span>
          <select value={locale} onChange={(e) => void changeLanguage(e.target.value as StaffLocale)}>
            {STAFF_LOCALES.map((code) => (
              <option key={code} value={code}>
                {LOCALE_INFO[code].nativeName}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-quiet" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? m.shell.themeLight : m.shell.themeDark}
        </button>
        <span className="staff-user">{me.user.name}</span>
        <button type="button" className="btn btn-secondary" onClick={() => void leave()}>
          {me.device ? m.shell.lock : m.shell.signOut}
        </button>
      </div>
    </header>
  )
}
