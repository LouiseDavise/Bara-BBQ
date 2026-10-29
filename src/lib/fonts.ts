// Adds the Noto CJK families for a locale's script, once. Google Fonts serves them in
// ~100 unicode-range slices, so a page only downloads the characters it uses.
import { LOCALE_INFO, type Locale, type Script } from '../../shared/locales'

const FAMILIES: Record<Exclude<Script, 'latin'>, { serif: string; sans: string }> = {
  tc: { serif: 'Noto+Serif+TC:wght@500;700', sans: 'Noto+Sans+TC:wght@400;500;700' },
  sc: { serif: 'Noto+Serif+SC:wght@500;700', sans: 'Noto+Sans+SC:wght@400;500;700' },
  jp: { serif: 'Noto+Serif+JP:wght@500;700', sans: 'Noto+Sans+JP:wght@400;500;700' },
  kr: { serif: 'Noto+Serif+KR:wght@500;700', sans: 'Noto+Sans+KR:wght@400;500;700' },
}

function addPreconnect(): void {
  if (document.querySelector('link[data-fonts-preconnect]')) return
  for (const [href, crossOrigin] of [
    ['https://fonts.googleapis.com', false],
    ['https://fonts.gstatic.com', true],
  ] as const) {
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = href
    if (crossOrigin) link.crossOrigin = 'anonymous'
    link.dataset.fontsPreconnect = ''
    document.head.append(link)
  }
}

/** `serif: false` for the staff app, which only uses the sans family. */
export function loadLocaleFonts(locale: Locale, options: { serif?: boolean } = {}): void {
  const script = LOCALE_INFO[locale].script
  if (script === 'latin') return
  const id = `fonts-${script}-${options.serif === false ? 'sans' : 'all'}`
  if (document.getElementById(id)) return
  const { serif, sans } = FAMILIES[script]
  const families = options.serif === false ? [sans] : [serif, sans]
  addPreconnect()
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&')}&display=swap`
  document.head.append(link)
}
