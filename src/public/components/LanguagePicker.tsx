// Header language picker. The language lives in the URL (/ja/…) and is remembered per device.
import { useLocation, useNavigate } from 'react-router-dom'
import { LOCALE_INFO, LOCALES, type Locale } from '../../../shared/locales'
import type { GuestMessages } from '../../i18n/types'

export function LanguagePicker({ locale, m }: { locale: Locale; m: GuestMessages }) {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  return (
    <label className="language-picker">
      <span className="visually-hidden">{m.language.choose}</span>
      <select
        value={locale}
        onChange={(event) => navigate(`${pathname.replace(/^\/[^/]+/, `/${event.target.value}`)}${search}`)}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={LOCALE_INFO[code].htmlLang}>
            {LOCALE_INFO[code].nativeName}
          </option>
        ))}
      </select>
    </label>
  )
}
