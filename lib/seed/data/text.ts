// Compact helper for seed text: L(en, zh-TW, zh-CN, id, ms, ja, ko).
import type { LocalizedText } from '../../../shared/localized.js'

export function L(en: string, zhTW: string, zhCN: string, id: string, ms: string, ja: string, ko: string): LocalizedText {
  return { en, 'zh-TW': zhTW, 'zh-CN': zhCN, id, ms, ja, ko }
}
