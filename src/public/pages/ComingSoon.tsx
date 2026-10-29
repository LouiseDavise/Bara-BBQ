// Phase 1 placeholder: proves the language, font and token setup in all seven languages.
import type { Locale } from '../../../shared/locales'
import type { GuestMessages } from '../../i18n/types'

export function ComingSoon({ m }: { locale: Locale; m: GuestMessages }) {
  return (
    <section className="coming">
      <p className="eyebrow">{m.meta.tagline}</p>
      <h1 className="coming-title">{m.home.comingTitle}</h1>
      <p className="coming-body">{m.home.comingBody}</p>
      <div className="coming-actions">
        <a className="button button-ember" href="/login">
          {m.home.staffLink}
        </a>
      </div>
    </section>
  )
}
