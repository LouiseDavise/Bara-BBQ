// Text stored per language (menu items, categories, modifiers, allergens, branch copy).
// English is always present; every other language is optional and falls back.
import type { Locale } from './locales.js'

export type LocalizedText = { en: string } & Partial<Record<Exclude<Locale, 'en'>, string>>

const filled = (value: string | undefined): value is string => typeof value === 'string' && value.trim() !== ''

/** The text in `locale`, else English, else the branch's default language. */
export function pickText(text: LocalizedText | null | undefined, locale: Locale, branchDefault?: Locale): string {
  if (!text) return ''
  const wanted = text[locale]
  if (filled(wanted)) return wanted
  if (filled(text.en)) return text.en
  const fallback = branchDefault ? text[branchDefault] : undefined
  return filled(fallback) ? fallback : ''
}

/** Which of `required` have no text yet, for the "translation missing" flags. */
export function missingLocales(text: LocalizedText | null | undefined, required: readonly Locale[]): Locale[] {
  return required.filter((locale) => !filled(text?.[locale]))
}

export const isFullyTranslated = (text: LocalizedText | null | undefined, required: readonly Locale[]): boolean =>
  missingLocales(text, required).length === 0
