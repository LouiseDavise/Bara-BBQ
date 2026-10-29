// Tender labels shared by the country profiles. Brand names stay as they are in every language.
import type { TenderDef } from './types.js'

export const TENDERS = {
  cash: { id: 'cash', kind: 'cash', label: { en: 'Cash', 'zh-TW': '現金', 'zh-CN': '现金', id: 'Tunai', ms: 'Tunai', ja: '現金', ko: '현금' } },
  card: { id: 'card', kind: 'card', label: { en: 'Card', 'zh-TW': '刷卡', 'zh-CN': '刷卡', id: 'Kartu (EDC)', ms: 'Kad', ja: 'カード', ko: '카드' } },
  bankTransfer: {
    id: 'bankTransfer',
    kind: 'transfer',
    label: { en: 'Bank transfer', 'zh-TW': '銀行轉帳', 'zh-CN': '银行转账', id: 'Transfer bank', ms: 'Pindahan bank', ja: '銀行振込', ko: '계좌이체' },
  },
  linePay: { id: 'linePay', kind: 'wallet', label: { en: 'LINE Pay' } },
  jkoPay: { id: 'jkoPay', kind: 'wallet', label: { en: 'JKOPay', 'zh-TW': '街口支付', 'zh-CN': '街口支付' } },
  easyCard: { id: 'easyCard', kind: 'wallet', label: { en: 'EasyCard', 'zh-TW': '悠遊卡', 'zh-CN': '悠游卡' } },
  qris: { id: 'qris', kind: 'wallet', label: { en: 'QRIS' } },
  goPay: { id: 'goPay', kind: 'wallet', label: { en: 'GoPay' } },
  ovo: { id: 'ovo', kind: 'wallet', label: { en: 'OVO' } },
  shopeePay: { id: 'shopeePay', kind: 'wallet', label: { en: 'ShopeePay' } },
  duitNow: { id: 'duitNow', kind: 'wallet', label: { en: 'DuitNow QR' } },
  tng: { id: 'tng', kind: 'wallet', label: { en: "Touch 'n Go eWallet" } },
  grabPay: { id: 'grabPay', kind: 'wallet', label: { en: 'GrabPay' } },
  nets: { id: 'nets', kind: 'card', label: { en: 'NETS' } },
  payNow: { id: 'payNow', kind: 'wallet', label: { en: 'PayNow' } },
} satisfies Record<string, TenderDef>
