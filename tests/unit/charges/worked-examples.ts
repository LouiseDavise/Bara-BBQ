// Worked examples per country, checked by hand. Amounts are minor units: NT$ and Rp are whole
// units; RM and S$ are sen and cents. Each row is a test in calculate-bill.test.ts.
import type { BillLine, Discount } from '../../../shared/charges/calculate-bill.js'
import type { Channel, CountryCode } from '../../../shared/country-profiles/types.js'
import type { PricingOverrides } from '../../../shared/settings.js'

export interface WorkedExample {
  name: string
  country: CountryCode
  channel: Channel
  pricing?: PricingOverrides
  packagingFee?: number
  /** [id, unit price, qty, category?, flags?] */
  lines: [string, number, number, string?, { voided?: boolean; comp?: boolean }?][]
  discounts?: Discount[]
  expected: {
    net: number
    serviceCharge: number
    tax: number
    total: number
    /** Cash payment of the full total (only when cash rounding matters). */
    cashDue?: number
  }
}

const JKT: PricingOverrides = { serviceCharge: { bp: 500 } }
const happyHour: Discount = { id: 'happy-hour', kind: 'percent', value: 2000, level: 'bill', categoryIds: ['drinks'] }

export const workedExamples: WorkedExample[] = [
  // ── Taiwan: prices include 5% business tax; tax is split out as total × 5 / 105 ──────────
  {
    name: 'TPE dine-in: 10% service, tax split out',
    country: 'TW',
    channel: 'dineIn',
    lines: [['iga', 880, 1], ['sate', 320, 2], ['nasi', 180, 1], ['jamu', 420, 2]],
    expected: { net: 2540, serviceCharge: 254, tax: 133, total: 2794 },
  },
  {
    name: 'TPE dine-in NT$2,560 (the split-bill flow)',
    country: 'TW',
    channel: 'dineIn',
    lines: [['iga', 880, 2], ['ikan', 800, 1]],
    expected: { net: 2560, serviceCharge: 256, tax: 134, total: 2816 },
  },
  {
    name: 'TPE takeaway: no service charge',
    country: 'TW',
    channel: 'takeaway',
    lines: [['iga', 880, 2], ['ikan', 800, 1]],
    expected: { net: 2560, serviceCharge: 0, tax: 122, total: 2560 },
  },
  {
    name: 'TPE single dish',
    country: 'TW',
    channel: 'dineIn',
    lines: [['ikan', 900, 1]],
    expected: { net: 900, serviceCharge: 90, tax: 47, total: 990 },
  },
  {
    name: 'TPE 10% bill discount comes before service charge',
    country: 'TW',
    channel: 'dineIn',
    lines: [['set', 1280, 1], ['iga', 880, 1]],
    discounts: [{ id: 'member10', kind: 'percent', value: 1000, level: 'bill' }],
    expected: { net: 1944, serviceCharge: 194, tax: 102, total: 2138 },
  },
  {
    name: 'TPE complimentary birthday dessert costs nothing',
    country: 'TW',
    channel: 'dineIn',
    lines: [['set', 1500, 1], ['klepon', 220, 1, 'dessert', { comp: true }]],
    expected: { net: 1500, serviceCharge: 150, tax: 79, total: 1650 },
  },
  {
    name: 'TPE counter sale: no service charge',
    country: 'TW',
    channel: 'counter',
    lines: [['kopi', 160, 3]],
    expected: { net: 480, serviceCharge: 0, tax: 23, total: 480 },
  },
  {
    name: 'TPE voided line is not charged',
    country: 'TW',
    channel: 'dineIn',
    lines: [['ikan', 900, 1], ['sate', 320, 1, undefined, { voided: true }]],
    expected: { net: 900, serviceCharge: 90, tax: 47, total: 990 },
  },
  {
    name: 'TPE bill-level rounding: 3 × NT$105',
    country: 'TW',
    channel: 'dineIn',
    lines: [['a', 105, 1], ['b', 105, 1], ['c', 105, 1]],
    expected: { net: 315, serviceCharge: 32, tax: 17, total: 347 },
  },
  {
    name: 'TPE line-level rounding: 3 × NT$105',
    country: 'TW',
    channel: 'dineIn',
    pricing: { rounding: { level: 'line' } },
    lines: [['a', 105, 1], ['b', 105, 1], ['c', 105, 1]],
    expected: { net: 315, serviceCharge: 33, tax: 18, total: 348 },
  },

  // ── Indonesia: ++ prices; PBJT 10% on subtotal + service charge ──────────────────────────
  {
    name: 'JKT dine-in: 5% service, PBJT on top',
    country: 'ID',
    channel: 'dineIn',
    pricing: JKT,
    lines: [['iga', 245000, 1], ['sate', 85000, 1], ['ikan', 120000, 1]],
    expected: { net: 450000, serviceCharge: 22500, tax: 47250, total: 519750 },
  },
  {
    name: 'JKT with optional Rp 100 cash rounding switched on',
    country: 'ID',
    channel: 'dineIn',
    pricing: { ...JKT, cashRounding: { enabled: true } },
    lines: [['iga', 245000, 1], ['sate', 85000, 1], ['ikan', 120000, 1]],
    expected: { net: 450000, serviceCharge: 22500, tax: 47250, total: 519750, cashDue: 519800 },
  },
  {
    name: 'DPS dine-in: 10% service',
    country: 'ID',
    channel: 'dineIn',
    lines: [['iga', 275000, 1], ['ikan', 175000, 1]],
    expected: { net: 450000, serviceCharge: 45000, tax: 49500, total: 544500 },
  },
  {
    name: 'JKT takeaway: PBJT, no service charge',
    country: 'ID',
    channel: 'takeaway',
    pricing: JKT,
    lines: [['iga', 245000, 1], ['nasi', 40000, 1]],
    expected: { net: 285000, serviceCharge: 0, tax: 28500, total: 313500 },
  },
  {
    name: 'JKT takeaway with a Rp 5.000 packaging fee (taxed)',
    country: 'ID',
    channel: 'takeaway',
    pricing: JKT,
    packagingFee: 5000,
    lines: [['iga', 245000, 1], ['nasi', 40000, 1]],
    expected: { net: 285000, serviceCharge: 0, tax: 29000, total: 319000 },
  },
  {
    name: 'DPS happy hour: 20% off drinks only',
    country: 'ID',
    channel: 'dineIn',
    lines: [['ikan', 380000, 1, 'food'], ['arak', 145000, 2, 'drinks']],
    discounts: [happyHour],
    expected: { net: 612000, serviceCharge: 61200, tax: 67320, total: 740520 },
  },
  {
    name: 'DPS odd amount rounds service and tax once each',
    country: 'ID',
    channel: 'dineIn',
    lines: [['odd', 333333, 1]],
    expected: { net: 333333, serviceCharge: 33333, tax: 36667, total: 403333 },
  },
  {
    name: 'JKT fixed Rp 50.000 voucher',
    country: 'ID',
    channel: 'dineIn',
    pricing: JKT,
    lines: [['iga', 245000, 1], ['sate', 85000, 1], ['ikan', 120000, 1]],
    discounts: [{ id: 'voucher', kind: 'fixed', value: 50000, level: 'bill' }],
    expected: { net: 400000, serviceCharge: 20000, tax: 42000, total: 462000 },
  },

  // ── Malaysia: ++ prices; SST 6% on subtotal + service; cash rounds to 5 sen ──────────────
  {
    name: 'KUL dine-in, cash rounds RM 101.79 up to RM 101.80',
    country: 'MY',
    channel: 'dineIn',
    lines: [['sate', 2590, 1], ['iga', 3850, 1], ['nasi', 2290, 1]],
    expected: { net: 8730, serviceCharge: 873, tax: 576, total: 10179, cashDue: 10180 },
  },
  {
    name: 'KUL SST not charged on service (setting off)',
    country: 'MY',
    channel: 'dineIn',
    pricing: { tax: { onServiceCharge: false } },
    lines: [['sate', 2590, 1], ['iga', 3850, 1], ['nasi', 2290, 1]],
    expected: { net: 8730, serviceCharge: 873, tax: 524, total: 10127, cashDue: 10125 },
  },
  {
    name: 'KUL takeaway already on a 5-sen step',
    country: 'MY',
    channel: 'takeaway',
    lines: [['nasi', 2290, 2]],
    expected: { net: 4580, serviceCharge: 0, tax: 275, total: 4855, cashDue: 4855 },
  },
  {
    name: 'KUL takeaway with RM 1.00 packaging',
    country: 'MY',
    channel: 'takeaway',
    packagingFee: 100,
    lines: [['nasi', 2290, 2]],
    expected: { net: 4580, serviceCharge: 0, tax: 281, total: 4961, cashDue: 4960 },
  },
  {
    name: 'KUL 10% off the bill',
    country: 'MY',
    channel: 'dineIn',
    lines: [['set', 12000, 1]],
    discounts: [{ id: 'promo', kind: 'percent', value: 1000, level: 'bill' }],
    expected: { net: 10800, serviceCharge: 1080, tax: 713, total: 12593, cashDue: 12595 },
  },
  {
    name: 'KUL service charge rounds half up',
    country: 'MY',
    channel: 'dineIn',
    lines: [['set', 9999, 1]],
    expected: { net: 9999, serviceCharge: 1000, tax: 660, total: 11659, cashDue: 11660 },
  },
  {
    name: 'KUL bill-level rounding: 3 × RM 0.10',
    country: 'MY',
    channel: 'takeaway',
    lines: [['a', 10, 1], ['b', 10, 1], ['c', 10, 1]],
    expected: { net: 30, serviceCharge: 0, tax: 2, total: 32, cashDue: 30 },
  },
  {
    name: 'KUL line-level rounding: 3 × RM 0.10',
    country: 'MY',
    channel: 'takeaway',
    pricing: { rounding: { level: 'line' } },
    lines: [['a', 10, 1], ['b', 10, 1], ['c', 10, 1]],
    expected: { net: 30, serviceCharge: 0, tax: 3, total: 33, cashDue: 35 },
  },

  // ── Singapore: ++ prices; GST 9% on subtotal + service charge ──────────────────────────────
  {
    name: 'SIN dine-in: S$106.00 → S$127.09 (the hand-checked flow)',
    country: 'SG',
    channel: 'dineIn',
    lines: [['sate', 1800, 2, 'food'], ['iga', 4200, 1, 'food'], ['jamu', 1400, 2, 'drinks']],
    expected: { net: 10600, serviceCharge: 1060, tax: 1049, total: 12709 },
  },
  {
    name: 'SIN happy hour 20% off drinks',
    country: 'SG',
    channel: 'dineIn',
    lines: [['sate', 1800, 2, 'food'], ['iga', 4200, 1, 'food'], ['jamu', 1400, 2, 'drinks']],
    discounts: [happyHour],
    expected: { net: 10040, serviceCharge: 1004, tax: 994, total: 12038 },
  },
  {
    name: 'SIN takeaway: GST only',
    country: 'SG',
    channel: 'takeaway',
    lines: [['sate', 1800, 2], ['iga', 4200, 1], ['jamu', 1400, 2]],
    expected: { net: 10600, serviceCharge: 0, tax: 954, total: 11554 },
  },
  {
    name: 'SIN takeaway with S$0.50 packaging',
    country: 'SG',
    channel: 'takeaway',
    packagingFee: 50,
    lines: [['sate', 1800, 2], ['iga', 4200, 1], ['jamu', 1400, 2]],
    expected: { net: 10600, serviceCharge: 0, tax: 959, total: 11609 },
  },
  {
    name: 'SIN optional 5¢ cash rounding switched on',
    country: 'SG',
    channel: 'dineIn',
    pricing: { cashRounding: { enabled: true } },
    lines: [['sate', 1800, 2], ['iga', 4200, 1], ['jamu', 1400, 2]],
    expected: { net: 10600, serviceCharge: 1060, tax: 1049, total: 12709, cashDue: 12710 },
  },
  {
    name: 'SIN counter sale: GST only',
    country: 'SG',
    channel: 'counter',
    lines: [['kopi', 3290, 1]],
    expected: { net: 3290, serviceCharge: 0, tax: 296, total: 3586 },
  },
  {
    name: 'SIN comp and void are left out of the charge',
    country: 'SG',
    channel: 'dineIn',
    lines: [['iga', 4200, 1], ['klepon', 1200, 1, 'dessert', { comp: true }], ['sate', 1800, 1, 'food', { voided: true }]],
    expected: { net: 4200, serviceCharge: 420, tax: 416, total: 5036 },
  },
  {
    name: 'SIN S$10 voucher',
    country: 'SG',
    channel: 'dineIn',
    lines: [['sate', 1800, 2], ['iga', 4200, 1], ['jamu', 1400, 2]],
    discounts: [{ id: 'voucher', kind: 'fixed', value: 1000, level: 'bill' }],
    expected: { net: 9600, serviceCharge: 960, tax: 950, total: 11510 },
  },
]

export function toLines(example: WorkedExample, currency: 'TWD' | 'IDR' | 'MYR' | 'SGD'): BillLine[] {
  return example.lines.map(([id, price, qty, categoryId, flags]) => ({
    id,
    unitPrice: { amount: price, currency },
    qty,
    ...(categoryId ? { categoryId } : {}),
    ...flags,
  }))
}
