import { TENDERS } from './tenders.js'
import type { CountryProfile } from './types.js'

export const taiwan: CountryProfile = {
  code: 'TW',
  name: { en: 'Taiwan', 'zh-TW': '台灣', 'zh-CN': '台湾', id: 'Taiwan', ms: 'Taiwan', ja: '台湾', ko: '대만' },
  lastReviewed: '2026-10-29',
  reviewNotes:
    'Menu prices include 5% business tax (營業稅), split out as total × 5 / 105. B2C e-invoices (電子發票) are mandatory; confirm the e-invoice provider contract, track allocation and the 401 filing with a local accountant.',
  currency: 'TWD',
  defaultTimeZone: 'Asia/Taipei',
  callingCode: '886',
  pricing: {
    serviceCharge: { bp: 1000, channels: ['dineIn'] },
    tax: { bp: 500, inclusive: true, onServiceCharge: true },
    rounding: { level: 'bill', mode: 'halfUp' },
    cashRounding: { enabled: true, required: false, increment: 1, mode: 'halfUp' },
  },
  taxName: { en: 'Business tax', 'zh-TW': '營業稅', 'zh-CN': '营业税', id: 'Pajak usaha', ms: 'Cukai perniagaan', ja: '営業税', ko: '영업세' },
  serviceChargeName: { en: 'Service charge', 'zh-TW': '服務費', 'zh-CN': '服务费', id: 'Biaya layanan', ms: 'Caj perkhidmatan', ja: 'サービス料', ko: '봉사료' },
  invoicing: {
    kind: 'tw-einvoice',
    taxIdField: 'ubn',
    taxIdLabel: { en: 'Tax ID (UBN)', 'zh-TW': '統一編號', 'zh-CN': '统一编号', id: 'Nomor pajak (UBN)', ms: 'Nombor cukai (UBN)', ja: '統一編號', ko: '사업자번호 (UBN)' },
    eInvoice: true,
  },
  tenders: [TENDERS.cash, TENDERS.card, TENDERS.linePay, TENDERS.jkoPay, TENDERS.easyCard],
  onlinePaymentProviders: ['mock', 'tappay', 'ecpay'],
  messaging: 'line',
  deliveryPlatforms: [
    { id: 'ubereats', name: 'Uber Eats' },
    { id: 'foodpanda', name: 'foodpanda' },
  ],
  taxReport: { period: 'bimonthly', form: '401' },
  phoneExample: '0912-345-678',
  guestLanguages: ['zh-TW', 'en', 'ja', 'ko', 'id'],
  denominations: [
    { value: 2000, kind: 'note' },
    { value: 1000, kind: 'note' },
    { value: 500, kind: 'note' },
    { value: 200, kind: 'note' },
    { value: 100, kind: 'note' },
    { value: 50, kind: 'coin' },
    { value: 10, kind: 'coin' },
    { value: 5, kind: 'coin' },
    { value: 1, kind: 'coin' },
  ],
  labour: { dailyLimitH: 12 },
  privacyLaw: {
    en: 'Personal Data Protection Act (Taiwan)',
    'zh-TW': '個人資料保護法',
    'zh-CN': '个人资料保护法（台湾）',
    id: 'Undang-Undang Perlindungan Data Pribadi (Taiwan)',
    ms: 'Akta Perlindungan Data Peribadi (Taiwan)',
    ja: '個人資料保護法（台湾）',
    ko: '개인정보보호법 (대만)',
  },
}
