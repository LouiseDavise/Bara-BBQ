// The seven guest languages, the five staff languages, and how to pick one from a browser.

export const LOCALES = ['zh-TW', 'zh-CN', 'en', 'id', 'ms', 'ja', 'ko'] as const
export type Locale = (typeof LOCALES)[number]

export const STAFF_LOCALES = ['zh-TW', 'zh-CN', 'en', 'id', 'ms'] as const
export type StaffLocale = (typeof STAFF_LOCALES)[number]

export type Script = 'latin' | 'tc' | 'sc' | 'jp' | 'kr'

export interface LocaleInfo {
  code: Locale
  /** Shown in the language picker, always in its own language. */
  nativeName: string
  englishName: string
  /** For <html lang> and hreflang. */
  htmlLang: string
  /** Which font family set this locale needs. */
  script: Script
  /** Locale passed to Intl for dates and times. */
  intl: string
}

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  'zh-TW': { code: 'zh-TW', nativeName: '繁體中文', englishName: 'Traditional Chinese', htmlLang: 'zh-TW', script: 'tc', intl: 'zh-TW' },
  'zh-CN': { code: 'zh-CN', nativeName: '简体中文', englishName: 'Simplified Chinese', htmlLang: 'zh-CN', script: 'sc', intl: 'zh-CN' },
  en: { code: 'en', nativeName: 'English', englishName: 'English', htmlLang: 'en', script: 'latin', intl: 'en-GB' },
  id: { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', htmlLang: 'id', script: 'latin', intl: 'id-ID' },
  ms: { code: 'ms', nativeName: 'Bahasa Melayu', englishName: 'Malay', htmlLang: 'ms', script: 'latin', intl: 'ms-MY' },
  ja: { code: 'ja', nativeName: '日本語', englishName: 'Japanese', htmlLang: 'ja', script: 'jp', intl: 'ja-JP' },
  ko: { code: 'ko', nativeName: '한국어', englishName: 'Korean', htmlLang: 'ko', script: 'kr', intl: 'ko-KR' },
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export function isStaffLocale(value: unknown): value is StaffLocale {
  return typeof value === 'string' && (STAFF_LOCALES as readonly string[]).includes(value)
}

/** Maps one BCP 47 tag from a browser to our locale, or null. */
export function localeFromTag(tag: string): Locale | null {
  const lower = tag.trim().toLowerCase()
  if (!lower) return null
  if (lower.startsWith('zh')) {
    // Traditional for Taiwan, Hong Kong, Macau and explicit Hant; Simplified otherwise.
    return /-(tw|hk|mo|hant)\b/.test(lower) ? 'zh-TW' : 'zh-CN'
  }
  const primary = lower.split('-')[0]
  if (primary === 'in') return 'id' // legacy code still sent by some Android builds
  if (primary === 'zsm' || primary === 'may') return 'ms'
  return isLocale(primary) ? primary : null
}

/**
 * Picks the best locale from an Accept-Language header (or navigator.languages joined with
 * commas), honouring q-values, limited to `allowed`. Falls back to `fallback`.
 */
export function matchLocale(
  acceptLanguage: string | null | undefined,
  allowed: readonly Locale[] = LOCALES,
  fallback: Locale = 'en',
): Locale {
  if (!acceptLanguage) return fallback
  const ranked = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.split(';')
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      const weight = q ? Number(q.slice(2)) : 1
      return { tag: tag.trim(), weight: Number.isFinite(weight) ? weight : 0, index }
    })
    .filter((entry) => entry.tag && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
  for (const entry of ranked) {
    const locale = localeFromTag(entry.tag)
    if (locale && allowed.includes(locale)) return locale
  }
  return fallback
}
