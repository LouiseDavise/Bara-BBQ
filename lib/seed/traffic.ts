// How busy each branch is and how its guests behave: Bali peaks at sunset, Singapore at lunch,
// Kuala Lumpur on weekends, Jakarta and Taipei late on Fridays and Saturdays.
import type { TenderId } from '../../shared/country-profiles/types.js'
import type { Weekday } from '../../shared/time/zoned.js'

export interface DemandWindow {
  from: string
  to: string
  /** Expected parties arriving per 15 minutes. */
  rate: number
  days?: Weekday[]
}

export interface Traffic {
  windows: DemandWindow[]
  /** Multiplier per weekday, Sunday first. */
  weekday: [number, number, number, number, number, number, number]
  takeawayPerDay: number
  reservationShare: { lunch: number; dinner: number }
  /** Bookings before this local time count as lunch. */
  lunchUntil: string
  /** Share of drinks that are alcoholic, where the branch serves alcohol. */
  alcoholShare: number
  /** Weights for spice levels 0–3. */
  spice: [number, number, number, number]
  payments: { dineIn: [TenderId, number][]; takeaway: [TenderId, number][] }
  /** Online provider method used for paid-online takeaway. */
  onlineMethod: TenderId
  onlineTakeawayShare: number
  tipChance: number
  happyHour: boolean
  /** Party sizes and their weights. */
  sizes: [number, number][]
  lunchSizes?: [number, number][]
  shortLunch?: boolean
  float: number
  payOut: number
}

const SIZES: [number, number][] = [
  [1, 8],
  [2, 38],
  [3, 14],
  [4, 22],
  [5, 5],
  [6, 7],
  [7, 2],
  [8, 3],
  [10, 1],
]

export const traffic: Record<string, Traffic> = {
  tpe: {
    windows: [
      { from: '11:30', to: '13:45', rate: 2.0 },
      { from: '17:30', to: '21:30', rate: 2.0 },
      { from: '21:30', to: '23:00', rate: 0.9, days: [5, 6] },
    ],
    weekday: [1.0, 0.8, 0.85, 0.9, 0.95, 1.15, 1.25],
    takeawayPerDay: 8,
    reservationShare: { lunch: 0.25, dinner: 0.55 },
    lunchUntil: '16:00',
    alcoholShare: 0.35,
    spice: [30, 45, 20, 5],
    payments: {
      dineIn: [['card', 35], ['cash', 28], ['linePay', 20], ['jkoPay', 10], ['easyCard', 7]],
      takeaway: [['linePay', 40], ['card', 30], ['cash', 20], ['jkoPay', 10]],
    },
    onlineMethod: 'linePay',
    onlineTakeawayShare: 0.55,
    tipChance: 0,
    happyHour: false,
    sizes: SIZES,
    float: 5_000,
    payOut: 600,
  },
  jkt: {
    windows: [
      { from: '11:30', to: '14:00', rate: 2.5 },
      { from: '18:00', to: '21:30', rate: 3.2 },
      { from: '21:30', to: '00:15', rate: 1.2, days: [5, 6] },
    ],
    weekday: [1.0, 0.85, 0.85, 0.9, 0.95, 1.2, 1.3],
    takeawayPerDay: 12,
    reservationShare: { lunch: 0.2, dinner: 0.45 },
    lunchUntil: '16:00',
    alcoholShare: 0.3,
    spice: [10, 30, 40, 20],
    payments: {
      dineIn: [['qris', 32], ['card', 30], ['cash', 14], ['goPay', 9], ['ovo', 6], ['shopeePay', 6], ['bankTransfer', 3]],
      takeaway: [['qris', 45], ['goPay', 20], ['shopeePay', 15], ['card', 10], ['cash', 10]],
    },
    onlineMethod: 'qris',
    onlineTakeawayShare: 0.6,
    tipChance: 0.1,
    happyHour: true,
    sizes: SIZES,
    float: 1_000_000,
    payOut: 150_000,
  },
  dps: {
    windows: [
      { from: '12:00', to: '14:30', rate: 1.0 },
      { from: '15:00', to: '17:00', rate: 0.8 },
      { from: '17:00', to: '19:30', rate: 3.6 },
      { from: '19:30', to: '21:45', rate: 1.8 },
    ],
    weekday: [1.1, 0.95, 0.95, 0.95, 1.0, 1.05, 1.15],
    takeawayPerDay: 5,
    reservationShare: { lunch: 0.15, dinner: 0.5 },
    lunchUntil: '16:00',
    alcoholShare: 0.55,
    spice: [30, 40, 22, 8],
    payments: {
      dineIn: [['card', 52], ['cash', 22], ['qris', 18], ['goPay', 4], ['ovo', 2], ['shopeePay', 2]],
      takeaway: [['qris', 50], ['card', 30], ['cash', 20]],
    },
    onlineMethod: 'qris',
    onlineTakeawayShare: 0.5,
    tipChance: 0.15,
    happyHour: true,
    sizes: SIZES,
    float: 1_000_000,
    payOut: 200_000,
  },
  kul: {
    windows: [
      { from: '10:30', to: '12:00', rate: 1.5, days: [0, 6] },
      { from: '12:00', to: '14:00', rate: 2.4 },
      { from: '18:30', to: '21:30', rate: 2.4 },
    ],
    weekday: [1.5, 0.8, 0.85, 0.85, 0.9, 1.0, 1.55],
    takeawayPerDay: 10,
    reservationShare: { lunch: 0.2, dinner: 0.4 },
    lunchUntil: '16:00',
    alcoholShare: 0,
    spice: [10, 35, 40, 15],
    payments: {
      dineIn: [['card', 45], ['duitNow', 20], ['tng', 16], ['cash', 14], ['grabPay', 5]],
      takeaway: [['duitNow', 40], ['tng', 25], ['card', 25], ['cash', 10]],
    },
    onlineMethod: 'card',
    onlineTakeawayShare: 0.55,
    tipChance: 0.03,
    happyHour: false,
    sizes: SIZES,
    float: 50_000,
    payOut: 3_000,
  },
  sin: {
    windows: [
      { from: '11:45', to: '13:45', rate: 4.6 },
      { from: '13:45', to: '14:00', rate: 1.0 },
      { from: '18:00', to: '21:00', rate: 2.0 },
    ],
    weekday: [0.8, 1.0, 1.0, 1.0, 1.05, 1.15, 0.75],
    takeawayPerDay: 10,
    reservationShare: { lunch: 0.15, dinner: 0.5 },
    lunchUntil: '16:00',
    alcoholShare: 0.4,
    spice: [25, 45, 25, 5],
    payments: {
      dineIn: [['card', 55], ['payNow', 18], ['nets', 14], ['grabPay', 8], ['cash', 5]],
      takeaway: [['payNow', 40], ['card', 35], ['grabPay', 15], ['cash', 10]],
    },
    onlineMethod: 'payNow',
    onlineTakeawayShare: 0.6,
    tipChance: 0.08,
    happyHour: true,
    sizes: SIZES,
    lunchSizes: [
      [1, 25],
      [2, 45],
      [3, 15],
      [4, 15],
    ],
    shortLunch: true,
    float: 30_000,
    payOut: 2_500,
  },
}

/** Monthly operating costs per branch, in minor units. */
export const monthlyCosts: Record<string, { rent: number; utilities: number; marketing: number; statutory: number; royalties: number; gasWeekly: number; maintenance: number; other: number }> = {
  tpe: { rent: 380_000, utilities: 42_000, marketing: 30_000, statutory: 95_000, royalties: 62_000, gasWeekly: 9_500, maintenance: 12_000, other: 4_000 },
  jkt: { rent: 180_000_000, utilities: 28_000_000, marketing: 20_000_000, statutory: 45_000_000, royalties: 38_000_000, gasWeekly: 6_500_000, maintenance: 7_500_000, other: 2_500_000 },
  dps: { rent: 150_000_000, utilities: 25_000_000, marketing: 25_000_000, statutory: 38_000_000, royalties: 36_000_000, gasWeekly: 6_000_000, maintenance: 7_000_000, other: 2_500_000 },
  kul: { rent: 3_800_000, utilities: 650_000, marketing: 400_000, statutory: 1_200_000, royalties: 900_000, gasWeekly: 140_000, maintenance: 180_000, other: 60_000 },
  sin: { rent: 3_200_000, utilities: 520_000, marketing: 350_000, statutory: 950_000, royalties: 820_000, gasWeekly: 110_000, maintenance: 150_000, other: 50_000 },
}
