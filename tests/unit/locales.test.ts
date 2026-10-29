import { describe, expect, it } from 'vitest'
import { matchLocale } from '../../shared/locales.js'
import { missingLocales, pickText } from '../../shared/localized.js'

describe('matchLocale', () => {
  it.each([
    ['zh-TW,zh;q=0.9,en;q=0.8', 'zh-TW'],
    ['zh-HK', 'zh-TW'],
    ['zh-Hant', 'zh-TW'],
    ['zh-CN,zh;q=0.9', 'zh-CN'],
    ['zh', 'zh-CN'],
    ['zh-SG', 'zh-CN'],
    ['ja-JP,ja;q=0.9', 'ja'],
    ['ko-KR', 'ko'],
    ['in-ID', 'id'],
    ['ms-MY', 'ms'],
    ['fr-FR,de;q=0.5', 'en'],
    ['en;q=0.5, ko;q=0.9', 'ko'],
    ['', 'en'],
  ] as const)('%s → %s', (header, expected) => {
    expect(matchLocale(header)).toBe(expected)
  })

  it('only picks from the allowed list', () => {
    expect(matchLocale('ja,ko;q=0.8,id;q=0.5', ['en', 'id'])).toBe('id')
    expect(matchLocale('ja', ['en', 'id'], 'id')).toBe('id')
  })
})

describe('localized text', () => {
  const text = { en: 'Grilled short rib', 'zh-TW': '炭烤牛小排', id: 'Iga bakar' }

  it('falls back to English, then the branch default', () => {
    expect(pickText(text, 'zh-TW')).toBe('炭烤牛小排')
    expect(pickText(text, 'ja')).toBe('Grilled short rib')
    expect(pickText({ en: ' ', id: 'Iga bakar' }, 'ja', 'id')).toBe('Iga bakar')
    expect(pickText(undefined, 'en')).toBe('')
  })

  it('lists the languages still missing', () => {
    expect(missingLocales(text, ['zh-TW', 'en', 'ja', 'ko', 'id'])).toEqual(['ja', 'ko'])
  })
})
