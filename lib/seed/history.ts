// The history generator. planDay() lays out one branch's whole business day deterministically
// (same branch + date → same day); generateDay() turns the part of it that falls inside a time
// window into Firestore documents. The seed generates 60 full days; the demo then extends
// "today" as it happens and the nightly job completes yesterday and drops the oldest day.
import { Timestamp } from 'firebase-admin/firestore'
import { calculateBill } from '../../shared/charges/calculate-bill.js'
import { cashDue } from '../../shared/charges/cash-rounding.js'
import type { Channel, TenderId } from '../../shared/country-profiles/types.js'
import type { Locale } from '../../shared/locales.js'
import { billNumber, CODE_ALPHABET, reservationCode, takeawayNumber } from '../../shared/numbering.js'
import { add, divRound, money, percentOf, roundToIncrement, split, subtract, sum, zero, type Money } from '../../shared/money.js'
import { toBillLine } from '../../shared/orders.js'
import { summarizeDay } from '../../shared/reports/daily-summary.js'
import { resolvePricing } from '../../shared/settings.js'
import { businessDayRange, compactDate } from '../../shared/time/business-day.js'
import { intervalsFor } from '../../shared/time/opening-hours.js'
import { addDays, daysBetween, fromZoned, localTime, minutesOf, weekdayOf, zonedParts } from '../../shared/time/zoned.js'
import { invoicePeriod } from '../../shared/tw/einvoice.js'
import type { DailySummary, ExpenseCategory, ExpenseDoc, FeedbackDoc, TimeEntryDoc } from '../../shared/types/finance.js'
import type { ReservationDoc, ReservationStatus } from '../../shared/types/guests.js'
import { MICRO, type PurchaseOrderDoc, type StockMovementDoc } from '../../shared/types/inventory.js'
import type { MenuItemDoc, ModifierGroupDoc } from '../../shared/types/menu.js'
import type { CashMovementDoc, InvoiceDoc, OrderDiscount, OrderDoc, OrderLine, PaymentDoc, ShiftDoc } from '../../shared/types/orders.js'
import type { StaffSeed } from './data/people.js'
import { Rng } from './prng.js'
import { monthlyCosts, traffic, type Traffic } from './traffic.js'
import { hourlyRateFor, type BranchWorld, type GuestSeed, type World } from './world.js'

export interface SeedDoc {
  path: string
  data: Record<string, unknown>
}

export interface Visit {
  customerId: string
  branchId: string
  at: number
  /** Bill total in minor units of the branch currency (0 for a no-show). */
  spend: number
  noShow: boolean
}

export interface DayResult {
  branchId: string
  businessDate: string
  docs: SeedDoc[]
  summary: DailySummary
  visits: Visit[]
  /** Bills and takeaway numbers the whole day uses, so live numbering starts after them. */
  plannedBills: number
  plannedTakeaways: number
}

export interface Window {
  /** Only events at or after this instant (epoch ms). */
  from?: number
  /** Only events before this instant (epoch ms). */
  until?: number
}

const MINUTE = 60_000
const ts = (ms: number) => Timestamp.fromMillis(ms)

// ── Plan ──────────────────────────────────────────────────────────────────────────────

interface Party {
  key: string
  channel: Channel
  arrival: number
  close: number
  size: number
  daypart: 'lunch' | 'dinner'
  tableIds: string[]
  tableLabel: string | null
  waiter: StaffSeed | null
  cashier: StaffSeed
  guest: GuestSeed | null
  language: Locale
  reserved: boolean
  occasion: ReservationDoc['occasion']
  online: boolean
  pickupAt: number
  staffMeal: boolean
  lines: OrderLine[]
  discounts: OrderDiscount[]
  rngSeed: string
}

interface ExtraReservation {
  key: string
  start: number
  size: number
  guest: GuestSeed
  status: 'noShow' | 'cancelled'
  language: Locale
}

export interface DayPlan {
  branchId: string
  date: string
  dayStart: number
  dayEnd: number
  open: { start: number; end: number } | null
  parties: Party[]
  extraReservations: ExtraReservation[]
}

const plans = new Map<string, DayPlan>()

function onShift(staff: StaffSeed, branchId: string, date: string, index: number): boolean {
  if (staff.roles[branchId] === 'manager') return weekdayOf(date) !== 1 // managers are off on Mondays
  const offA = (index * 3) % 7
  const offB = (offA + 4) % 7
  const weekday = weekdayOf(date)
  return weekday !== offA && weekday !== offB
}

function staffOnDuty(bw: BranchWorld, date: string, role: StaffSeed['roles'][string], daypart: 'lunch' | 'dinner'): StaffSeed[] {
  const people = bw.staffByRole[role]
  const working = people.filter((s, i) => onShift(s, bw.branch.id, date, i))
  const matching = working.filter((s) => s.shift === 'full' || (daypart === 'lunch' ? s.shift === 'am' : s.shift === 'pm'))
  return matching.length ? matching : working.length ? working : people
}

function demandAt(t: Traffic, minute: number, weekday: number): number {
  let rate = 0
  for (const window of t.windows) {
    if (window.days && !window.days.includes(weekday as 0)) continue
    const from = minutesOf(window.from)
    let to = minutesOf(window.to)
    let m = minute
    if (to <= from) {
      to += 1440
      if (m < from) m += 1440
    }
    if (m >= from && m < to) rate += window.rate
  }
  return rate
}

function pickItems(rng: Rng, bw: BranchWorld, category: string, count: number): MenuItemDoc[] {
  const candidates = bw.menu.filter((item) => item.categoryId === category && item.active)
  if (!candidates.length || count <= 0) return []
  const weighted = candidates.map((item) => [item, (item.badges.chefsPick ? 3 : 1) + (item.badges.onlyHere ? 1.5 : 0)] as const)
  return Array.from({ length: count }, () => rng.weighted(weighted))
}

function buildLine(
  rng: Rng,
  world: World,
  bw: BranchWorld,
  item: MenuItemDoc,
  t: Traffic,
  index: number,
  addedBy: string,
  addedAt: number,
  firedAt: number,
  seat: number | null,
): OrderLine {
  const currency = bw.currency
  const modifiers: OrderLine['modifiers'] = []
  const recipe = [...(bw.recipes.get(item.id) ?? [])]
  const allergens = new Set(item.allergenIds)
  let spice: number | null = null
  for (const groupId of item.modifierGroupIds) {
    const group: ModifierGroupDoc | undefined = world.modifierGroups.get(groupId)
    if (!group) continue
    let options: typeof group.options = []
    if (group.kind === 'spice') {
      const level = rng.weighted(t.spice.map((w, i) => [i, w] as const))
      spice = level
      options = [group.options[Math.min(level, group.options.length - 1)]!]
    } else if (group.kind === 'portion') {
      options = [rng.chance(0.2) ? group.options[1]! : group.options[0]!]
    } else if (group.kind === 'sweetness') {
      options = [rng.chance(0.3) ? group.options[1]! : group.options[0]!]
    } else if (group.kind === 'addon') {
      if (rng.chance(0.15)) options = [rng.pick(group.options)]
    } else if (group.required) {
      options = [rng.pick(group.options)]
    }
    for (const option of options) {
      modifiers.push({ groupId, optionId: option.id, name: option.name, priceDelta: money(option.priceDelta[currency] ?? 0, currency) })
      option.recipe?.forEach((line) => recipe.push(line))
      option.allergenIds?.forEach((a) => allergens.add(a))
    }
  }
  return {
    id: `l${index}`,
    menuItemId: item.id,
    masterItemId: item.masterItemId,
    categoryId: item.categoryId,
    name: item.name,
    unitPrice: item.price,
    modifiers,
    qty: 1,
    spice,
    notes: null,
    seat,
    course: item.categoryId === 'dessert' ? 3 : ['grill', 'seafood', 'rice'].includes(item.categoryId) ? 2 : 1,
    held: false,
    station: item.station,
    status: 'served',
    allergenIds: [...allergens],
    recipe,
    addedBy,
    addedAt: ts(addedAt),
    firedAt: ts(firedAt),
    voided: null,
    comp: null,
  }
}

/** Merges identical lines (same item and modifiers) into one line with a quantity. */
function mergeLines(lines: OrderLine[]): OrderLine[] {
  const merged = new Map<string, OrderLine>()
  for (const line of lines) {
    const key = `${line.menuItemId}|${line.modifiers.map((m) => m.optionId).join(',')}|${line.seat ?? ''}`
    const existing = merged.get(key)
    if (existing) existing.qty += 1
    else merged.set(key, { ...line, id: `l${merged.size + 1}` })
  }
  return [...merged.values()]
}

function pickGuest(rng: Rng, bw: BranchWorld, world: World): GuestSeed {
  // A few guests are travellers who also eat at Bara in another city.
  if (rng.chance(0.04)) {
    const other = world.branches[rng.pick(world.branchIds.filter((id) => id !== bw.branch.id))]!
    return rng.pick(other.guests)
  }
  return rng.pick(bw.guests)
}

export function planDay(world: World, branchId: string, date: string): DayPlan {
  const cacheKey = `${branchId}|${date}`
  const hit = plans.get(cacheKey)
  if (hit) return hit
  const bw = world.branches[branchId]!
  const branch = bw.branch
  const t = traffic[branchId]!
  const rng = new Rng(`day|${branchId}|${date}`)
  const tz = branch.timeZone
  const { start: dayStart, end: dayEnd } = businessDayRange(date, tz, branch.settings.businessDayCutoff)
  const intervals = intervalsFor(date, branch.hours, branch.specialDays, tz)
  const weekday = weekdayOf(date)
  const trend = 1 + 0.0004 * daysBetween('2026-01-01', date)
  const noise = 0.88 + rng.next() * 0.24
  const parties: Party[] = []
  const extraReservations: ExtraReservation[] = []
  const busyUntil = new Map<string, number>()
  const tables = [...bw.tables].sort((a, b) => a.seats.max - b.seats.max)
  let lineCounter = 0

  const findTables = (size: number, at: number, reserved: boolean): string[] | null => {
    const free = (id: string) => (busyUntil.get(id) ?? 0) <= at
    const single = tables.find((table) => table.seats.max >= size && table.seats.min <= size && free(table.id) && (reserved ? table.onlineBookable : true))
    if (single) return [single.id]
    for (const table of tables) {
      if (!free(table.id)) continue
      const partner = table.combinableWith.map((id) => tables.find((x) => x.id === id)!).find((other) => other && free(other.id) && other.seats.max + table.seats.max >= size)
      if (partner) return [table.id, partner.id]
    }
    return null
  }

  const durationFor = (size: number, daypart: 'lunch' | 'dinner') => {
    if (daypart === 'lunch' && t.shortLunch) return rng.int(48, 65)
    const rule = branch.settings.reservations.durations.find((d) => size <= d.maxParty) ?? branch.settings.reservations.durations.at(-1)!
    const base = daypart === 'lunch' ? rule.lunchMin : rule.dinnerMin
    return Math.round(base * (0.75 + rng.next() * 0.35))
  }

  const languageFor = (guest: GuestSeed | null): Locale => {
    if (guest && branch.languages.enabled.includes(guest.language)) return guest.language
    return branch.languages.default
  }

  const openSpan = intervals.length ? { start: intervals[0]!.start.getTime(), end: intervals.at(-1)!.end.getTime() } : null

  for (const interval of intervals) {
    const start = interval.start.getTime()
    const end = interval.end.getTime()
    for (let bucket = start; bucket < end - 45 * MINUTE; bucket += 15 * MINUTE) {
      const local = zonedParts(bucket, tz)
      const minute = local.hour * 60 + local.minute
      const lambda = demandAt(t, minute, weekday) * t.weekday[weekday]! * trend * noise
      const count = rng.poisson(lambda)
      for (let n = 0; n < count; n++) {
        const arrival = bucket + rng.int(0, 14) * MINUTE
        const daypart = minute < minutesOf(t.lunchUntil) ? 'lunch' : 'dinner'
        const size = rng.weighted(daypart === 'lunch' && t.lunchSizes ? t.lunchSizes : t.sizes)
        const reserved = rng.chance(t.reservationShare[daypart])
        const tableIds = findTables(size, arrival, reserved)
        if (!tableIds) continue
        const duration = durationFor(size, daypart)
        const close = Math.min(arrival + duration * MINUTE, end + 30 * MINUTE)
        tableIds.forEach((id) => busyUntil.set(id, close + branch.settings.reservations.bufferMin * MINUTE))
        const guest = reserved || rng.chance(0.2) ? pickGuest(rng, bw, world) : null
        const waiter = rng.pick(staffOnDuty(bw, date, 'waiter', daypart))
        const cashier = rng.pick(staffOnDuty(bw, date, 'cashier', daypart))
        parties.push({
          key: `${parties.length}`,
          channel: 'dineIn',
          arrival,
          close,
          size,
          daypart,
          tableIds,
          tableLabel: tableIds.map((id) => bw.tables.find((x) => x.id === id)!.label).join('+'),
          waiter,
          cashier,
          guest,
          language: languageFor(guest),
          reserved,
          occasion: reserved ? rng.weighted<ReservationDoc['occasion']>([[null, 86], ['birthday', 7], ['anniversary', 3], ['business', 2], ['date', 2]]) : null,
          online: false,
          pickupAt: 0,
          staffMeal: false,
          lines: [],
          discounts: [],
          rngSeed: `${branchId}|${date}|p${parties.length}`,
        })
        if (reserved && guest && rng.chance(0.13)) {
          extraReservations.push({
            key: `${extraReservations.length}`,
            start: arrival + rng.int(0, 3) * 15 * MINUTE,
            size: rng.weighted(t.sizes),
            guest: pickGuest(rng, bw, world),
            status: rng.chance(0.4) ? 'noShow' : 'cancelled',
            language: languageFor(guest),
          })
        }
      }
    }
  }

  // Takeaway: online and at the counter, spread like the dine-in demand.
  if (openSpan && branch.settings.takeaway.enabled) {
    const count = rng.poisson(t.takeawayPerDay * t.weekday[weekday]! * trend * noise)
    for (let n = 0; n < count; n++) {
      const interval = rng.pick(intervals)
      const span = interval.end.getTime() - interval.start.getTime() - 60 * MINUTE
      if (span <= 0) continue
      const arrival = interval.start.getTime() + Math.floor(rng.next() * span)
      const online = rng.chance(t.onlineTakeawayShare)
      const asap = rng.chance(0.7)
      const pickupAt = arrival + (branch.settings.takeaway.prepMin + (asap ? rng.int(0, 10) : rng.int(20, 60))) * MINUTE
      const guest = online || rng.chance(0.3) ? pickGuest(rng, bw, world) : null
      const minute = zonedParts(arrival, tz).hour * 60
      const daypart = minute < minutesOf(t.lunchUntil) ? 'lunch' : 'dinner'
      parties.push({
        key: `${parties.length}`,
        channel: 'takeaway',
        arrival,
        close: pickupAt + rng.int(0, 8) * MINUTE,
        size: rng.int(1, 3),
        daypart,
        tableIds: [],
        tableLabel: null,
        waiter: null,
        cashier: rng.pick(staffOnDuty(bw, date, 'cashier', daypart)),
        guest,
        language: languageFor(guest),
        reserved: false,
        occasion: null,
        online,
        pickupAt,
        staffMeal: false,
        lines: [],
        discounts: [],
        rngSeed: `${branchId}|${date}|p${parties.length}`,
      })
    }
    // One staff meal a day, rung up at the counter and comped.
    const mealAt = openSpan.start + 3 * 60 * MINUTE
    parties.push({
      key: `${parties.length}`,
      channel: 'counter',
      arrival: mealAt,
      close: mealAt + 25 * MINUTE,
      size: 1,
      daypart: 'lunch',
      tableIds: [],
      tableLabel: null,
      waiter: null,
      cashier: rng.pick(staffOnDuty(bw, date, 'cashier', 'lunch')),
      guest: null,
      language: branch.languages.default,
      reserved: false,
      occasion: null,
      online: false,
      pickupAt: 0,
      staffMeal: true,
      lines: [],
      discounts: [],
      rngSeed: `${branchId}|${date}|meal`,
    })
  }

  parties.sort((a, b) => a.arrival - b.arrival)

  // Orders: what each party ate and drank.
  for (const party of parties) {
    const prng = new Rng(party.rngSeed)
    const by = party.online ? 'guest' : (party.waiter?.id ?? party.cashier.id)
    const firedAt = party.arrival + 6 * MINUTE
    const picks: MenuItemDoc[] = []
    const alcohol = branch.flags.alcohol ? t.alcoholShare * (party.daypart === 'lunch' ? 0.4 : 1) : 0
    if (party.staffMeal) {
      picks.push(...pickItems(prng, bw, 'rice', 2), ...pickItems(prng, bw, 'zero', 1))
    } else if (party.channel === 'takeaway') {
      picks.push(...pickItems(prng, bw, prng.pick(['grill', 'seafood', 'sate']), party.size), ...pickItems(prng, bw, 'rice', prng.int(0, party.size)), ...pickItems(prng, bw, 'zero', prng.int(0, 2)))
    } else {
      const covers = party.size
      if (party.daypart === 'lunch' && t.shortLunch) {
        picks.push(...pickItems(prng, bw, prng.pick(['grill', 'seafood', 'rice']), covers), ...pickItems(prng, bw, 'zero', covers))
        if (prng.chance(0.3)) picks.push(...pickItems(prng, bw, 'sate', 1))
      } else {
        picks.push(...pickItems(prng, bw, 'sate', Math.ceil(covers / 2)))
        for (let i = 0; i < Math.ceil(covers / 1.8); i++) picks.push(...pickItems(prng, bw, prng.weighted([['grill', 55], ['seafood', 45]]), 1))
        picks.push(...pickItems(prng, bw, 'veg', Math.ceil(covers / 3)))
        picks.push(...pickItems(prng, bw, 'rice', Math.ceil(covers / 2)))
        for (let i = 0; i < covers; i++) {
          if (prng.chance(0.8)) picks.push(...pickItems(prng, bw, prng.chance(alcohol) ? 'cocktails' : 'zero', 1))
        }
        for (let i = 0; i < covers; i++) if (prng.chance(0.28)) picks.push(...pickItems(prng, bw, 'dessert', 1))
      }
    }
    const raw = picks.map((item) => {
      lineCounter += 1
      const seat = party.channel === 'dineIn' && prng.chance(0.3) ? prng.int(1, party.size) : null
      const at = item.categoryId === 'dessert' ? party.close - 25 * MINUTE : firedAt
      return buildLine(prng, world, bw, item, t, lineCounter, by, party.arrival + 4 * MINUTE, Math.max(at, firedAt), seat)
    })
    let lines = mergeLines(raw)
    if (party.staffMeal) lines = lines.map((line) => ({ ...line, comp: { reason: 'Staff meal', by: party.cashier.id } }))
    if (party.occasion === 'birthday') {
      const dessert = bw.menu.find((item) => item.id === 'klepon') ?? bw.menu.find((item) => item.categoryId === 'dessert')
      if (dessert) {
        const line = buildLine(prng, world, bw, dessert, t, lines.length + 1, by, party.close - 30 * MINUTE, party.close - 25 * MINUTE, null)
        lines.push({ ...line, id: `l${lines.length + 1}`, comp: { reason: 'Birthday dessert', by } })
      }
    }
    // A few fired items get voided with a reason and a manager's approval.
    if (party.channel === 'dineIn' && lines.length > 1 && prng.chance(0.03)) {
      const victim = lines[prng.int(0, lines.length - 1)]!
      const manager = bw.staffByRole.manager[0]
      const cooked = prng.chance(0.4)
      const voided: OrderLine = {
        ...victim,
        id: `l${lines.length + 1}`,
        qty: 1,
        status: 'voided',
        voided: {
          reason: prng.pick(['Guest changed their mind', 'Wrong order taken', 'Dish came out wrong', 'Too long a wait']),
          by,
          approvedBy: manager?.id ?? null,
          returnedStock: !cooked,
          at: ts(firedAt + 12 * MINUTE),
        },
      }
      if (victim.qty > 1) victim.qty -= 1
      else lines.splice(lines.indexOf(victim), 1)
      lines.push(voided)
    }
    party.lines = lines.map((line, i) => ({ ...line, id: `l${i + 1}` }))

    const localStart = minutesOf(localTime(party.arrival, tz))
    if (t.happyHour && party.channel === 'dineIn' && localStart >= minutesOf('17:30') && localStart < minutesOf('19:00')) {
      party.discounts.push({ id: 'happy-hour', kind: 'percent', value: 2000, level: 'bill', categoryIds: ['cocktails', 'zero'], name: 'Happy hour 20% off drinks', promoId: 'happy-hour', by, approvedBy: null })
    } else if (!party.staffMeal && party.guest && prng.chance(0.06)) {
      party.discounts.push({ id: 'friends', kind: 'percent', value: 1000, level: 'bill', name: 'Bara Friends 10%', promoId: 'bara-friends', by, approvedBy: null })
    }
  }

  const plan: DayPlan = { branchId, date, dayStart: dayStart.getTime(), dayEnd: dayEnd.getTime(), open: openSpan, parties, extraReservations }
  plans.set(cacheKey, plan)
  return plan
}

export function forgetPlans(): void {
  plans.clear()
}

// ── Documents ─────────────────────────────────────────────────────────────────────────

const TW_TRACKS = ['AB', 'CD', 'EF', 'GH', 'JK', 'LM']
const CARD_BRANDS: [string, number][] = [['Visa', 50], ['Mastercard', 35], ['JCB', 8], ['Amex', 7]]
const FEEDBACK: Record<Locale, string[]> = {
  en: ['The iga bakar was outstanding.', 'Lovely service, and the sambal matah is addictive.', 'Great atmosphere, we will be back.', 'Good food but we waited a while for our mains.', 'A bit too spicy even on mild.'],
  'zh-TW': ['牛小排超好吃！', '服務很親切，生參巴很涮嘴。', '氣氛很好，會再來。', '餐點不錯，但主餐等了有點久。', '小辣對我來說還是太辣了。'],
  'zh-CN': ['牛小排太好吃了！', '服务很热情，生参巴很上瘾。', '氛围很好，还会再来。', '菜不错，但主菜等了挺久。', '微辣对我来说还是太辣。'],
  id: ['Iga bakarnya juara!', 'Pelayanan ramah, sambal matahnya bikin nagih.', 'Suasananya enak, pasti balik lagi.', 'Makanannya enak tapi menunggu hidangan utama agak lama.', 'Level sedikit pedas pun masih terlalu pedas buat saya.'],
  ms: ['Iga bakar memang terbaik!', 'Layanan mesra dan sambal matah sangat sedap.', 'Suasana best, pasti datang lagi.', 'Makanan sedap tapi lama menunggu hidangan utama.', 'Tahap sedikit pedas pun masih terlalu pedas.'],
  ja: ['イガ・バカールが最高でした。', 'サービスが温かく、サンバル・マタがやみつきに。', '雰囲気が良く、また来たいです。', '料理はおいしいけれど、メインまで少し待ちました。', '控えめでも辛すぎました。'],
  ko: ['이가 바까르 정말 맛있었어요.', '서비스가 친절하고 삼발 마타가 중독적이에요.', '분위기가 좋아서 또 올게요.', '음식은 좋았지만 메인이 좀 늦게 나왔어요.', '약간 맵게도 저한테는 너무 매웠어요.'],
}

/** What a reservation looks like at `until`: done if it already happened, still booked if not. */
function reservationStatus(start: number, close: number | null, until: number, planned: ReservationStatus | null, futureConfirmed: boolean): ReservationStatus {
  if (planned === 'cancelled') return 'cancelled'
  if (start > until) return futureConfirmed ? 'confirmed' : 'booked'
  if (planned === 'noShow') return start + 20 * MINUTE <= until ? 'noShow' : 'confirmed'
  if (close !== null && close <= until) return 'finished'
  return 'seated'
}

const inWindow = (at: number, window: Window) => (window.from === undefined || at >= window.from) && (window.until === undefined || at < window.until)

function tenderUnit(currency: string): number[] {
  if (currency === 'TWD') return [100, 500, 1_000]
  if (currency === 'IDR') return [10_000, 50_000, 100_000]
  return [1_000, 5_000]
}

export function generateDay(world: World, branchId: string, date: string, window: Window = {}): DayResult {
  const bw = world.branches[branchId]!
  const branch = bw.branch
  const t = traffic[branchId]!
  const plan = planDay(world, branchId, date)
  const until = window.until ?? plan.dayEnd
  const currency = bw.currency
  const tz = branch.timeZone
  const rules = resolvePricing(bw.profile, branch.settings.pricing)
  const code = branch.code
  const compact = compactDate(date)
  const base = `branches/${branchId}`
  const docs: SeedDoc[] = []
  const emit = (collection: string, id: string, data: object) => docs.push({ path: `${base}/${collection}/${id}`, data: data as Record<string, unknown> })
  const visits: Visit[] = []
  const manager = bw.staffByRole.manager[0]!

  // Everything below is computed for the whole day (so random choices never depend on the
  // window); only what happens inside the window is emitted. The summary covers the whole day
  // up to `until`, whichever run wrote the documents.
  const closedOrders: OrderDoc[] = []
  const closedPayments: PaymentDoc[] = []
  const feedbackUpTo: FeedbackDoc[] = []
  const reservationsAt: ReservationDoc[] = []
  const shiftId = `h${compact}-1`
  let cashIn = zero(currency)
  let lastClose = plan.open?.start ?? plan.dayStart
  let takeawaySeq = 0
  const track = TW_TRACKS[(Number(date.slice(5, 7)) - 1) >> 1]!
  const periodStart = `${date.slice(0, 5)}${String(Number(date.slice(5, 7)) % 2 === 1 ? Number(date.slice(5, 7)) : Number(date.slice(5, 7)) - 1).padStart(2, '0')}-01`
  const usage = new Map<string, number>()

  plan.parties.forEach((party, index) => {
    const billSeq = index + 1
    const orderId = `h${compact}-${String(billSeq).padStart(4, '0')}`
    const number = billNumber(code, date, billSeq)
    const takeaway = party.channel === 'takeaway' ? takeawayNumber(code, (takeawaySeq += 1)) : null
    const bill = calculateBill(party.lines.map(toBillLine), party.discounts, bw.profile, branch.settings, party.channel)
    const closed = party.close <= until
    const emitNow = closed && inWindow(party.close, window)

    if (closed) {
      for (const line of party.lines) {
        if (line.status === 'voided' && line.voided?.returnedStock) continue
        for (const r of line.recipe) usage.set(r.ingredientId, (usage.get(r.ingredientId) ?? 0) + r.qty * line.qty)
      }
    }

    // Payments
    const pay = new Rng(`${party.rngSeed}|pay`)
    const payments: PaymentDoc[] = []
    if (bill.total.amount > 0) {
      const parts = party.size >= 3 && party.channel === 'dineIn' && pay.chance(0.06) ? split(bill.total, 2) : [bill.total]
      parts.forEach((part, i) => {
        const online = party.channel === 'takeaway' && party.online
        const method: TenderId = online ? t.onlineMethod : pay.weighted(party.channel === 'dineIn' ? t.payments.dineIn : t.payments.takeaway)
        const unit = pay.pick(tenderUnit(currency))
        const brand = pay.weighted(CARD_BRANDS)
        const approval = pay.chars('0123456789', 6)
        const tipRoll = pay.next()
        const tipBp = pay.pick([500, 1000])
        let rounding = zero(currency)
        let tendered: Money | null = null
        let change: Money | null = null
        if (method === 'cash') {
          const due = cashDue(part, rules.cashRounding)
          rounding = due.adjustment
          tendered = roundToIncrement(due.due, unit, 'up')
          change = subtract(tendered, due.due)
        }
        const card = method === 'card' || method === 'nets' ? { brand: method === 'nets' ? 'NETS' : brand, approvalCode: approval } : null
        let tip = zero(currency)
        if (card && tipRoll < t.tipChance) {
          const raw = percentOf(part, tipBp, 'halfUp')
          tip = roundToIncrement(raw, currency === 'IDR' ? 1_000 : currency === 'TWD' ? 10 : 100, 'halfUp')
        }
        payments.push({
          id: `${orderId}-${i + 1}`,
          orderId,
          orderNumber: number,
          checkId: parts.length > 1 ? `c${i + 1}` : null,
          method,
          amount: part,
          rounding,
          tip,
          tendered,
          change,
          provider: online ? 'mock' : method === 'cash' ? 'cash' : 'terminal',
          providerRef: online ? `mock_${orderId}_${i + 1}` : null,
          card,
          status: 'succeeded',
          shiftId: online ? null : shiftId,
          at: ts(online ? party.arrival + 2 * MINUTE : party.close - 2 * MINUTE),
          businessDate: date,
          by: online ? 'guest' : party.cashier.id,
          idempotencyKey: null,
          origin: 'seed',
        })
      })
    }

    const misc = new Rng(`${party.rngSeed}|misc`)
    const viaQr = misc.chance(0.25)
    const statusToken = misc.chars(CODE_ALPHABET.toLowerCase() + CODE_ALPHABET, 24)
    const order: OrderDoc = {
      id: orderId,
      number,
      channel: party.channel,
      source: party.staffMeal ? 'pos' : party.channel === 'takeaway' ? (party.online ? 'online' : 'pos') : party.guest && !party.reserved && viaQr ? 'qr' : 'waiter',
      status: 'closed',
      sessionId: party.channel === 'dineIn' ? `hs${compact}-${billSeq}` : null,
      tableIds: party.tableIds,
      tableLabel: party.tableLabel,
      covers: party.channel === 'dineIn' ? party.size : null,
      reservationId: party.reserved && party.guest ? `r${compact}-${party.key}` : null,
      takeaway: takeaway
        ? {
            number: takeaway,
            pickupAt: ts(party.pickupAt),
            asap: party.pickupAt - party.arrival <= (branch.settings.takeaway.prepMin + 10) * MINUTE,
            name: party.guest?.name ?? 'Walk-in',
            phoneE164: party.guest?.phoneE164 ?? branch.phoneE164,
            statusToken,
            status: 'pickedUp',
            payAtPickup: !party.online,
          }
        : null,
      guestLanguage: party.language,
      customerId: party.guest?.id ?? null,
      lines: party.lines,
      discounts: party.discounts,
      pricing: bill.rules,
      totals: {
        gross: bill.gross,
        comps: bill.comps,
        itemDiscounts: bill.itemDiscounts,
        billDiscounts: bill.billDiscounts,
        net: bill.net,
        packagingFee: bill.packagingFee,
        subtotal: bill.subtotal,
        serviceCharge: bill.serviceCharge,
        tax: bill.tax,
        taxInclusive: bill.taxInclusive,
        total: bill.total,
      },
      checks: [],
      paid: bill.total,
      tips: sum(payments.map((p) => p.tip), currency),
      balance: zero(currency),
      cashRounding: sum(payments.map((p) => p.rounding), currency),
      openedAt: ts(party.arrival),
      openedBy: party.channel === 'takeaway' && party.online ? 'guest' : (party.waiter ?? party.cashier).id,
      serverId: party.waiter?.id ?? null,
      closedAt: ts(party.close),
      closedBy: party.cashier.id,
      openedBusinessDate: date,
      businessDate: date,
      version: 1,
      origin: 'seed',
    }

    if (closed) {
      closedOrders.push(order)
      closedPayments.push(...payments)
      for (const payment of payments) if (payment.method === 'cash') cashIn = add(cashIn, add(payment.amount, payment.rounding))
      lastClose = Math.max(lastClose, party.close)
    }
    if (emitNow) {
      emit('orders', orderId, order)
      payments.forEach((payment) => emit('payments', payment.id, payment))
      if (party.guest) visits.push({ customerId: party.guest.id, branchId, at: party.close, spend: bill.total.amount, noShow: false })
    }

    // Invoices: Taiwan issues an e-invoice for every paid bill; Malaysia and Singapore on request.
    const inv = new Rng(`${party.rngSeed}|inv`)
    const invoiceRoll = inv.next()
    const carrierRoll = inv.next()
    const randomCode = inv.chars('0123456789', 4)
    const carrierId = inv.chars('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+-.', 7)
    if (emitNow && bill.total.amount > 0) {
      const amounts = { net: subtract(bill.total, bill.tax), tax: bill.tax, total: bill.total }
      const common = { orderId, orderNumber: number, checkId: null, amounts, providerRef: null, issuedAt: ts(party.close), businessDate: date, origin: 'seed' as const }
      let invoice: InvoiceDoc | null = null
      if (branch.country === 'TW') {
        const b2b = invoiceRoll < 0.05
        invoice = {
          ...common,
          id: orderId,
          type: b2b ? 'tw-b2b' : 'tw-b2c',
          number: `${track}${String(20_000_000 + daysBetween(periodStart, date) * 500 + billSeq).padStart(8, '0')}`,
          randomCode,
          carrier: !b2b && carrierRoll < 0.35 ? { type: 'mobile', id: `/${carrierId}` } : null,
          donationCode: !b2b && carrierRoll >= 0.35 && carrierRoll < 0.4 ? '25885' : null,
          buyer: b2b ? { name: '範例貿易股份有限公司', taxId: '53212539', brn: null, address: null, email: null } : null,
          period: invoicePeriod(date),
          status: 'issued',
          printed: b2b || carrierRoll >= 0.4,
          provider: 'mock',
        }
      } else if (branch.country === 'MY' && invoiceRoll < 0.02) {
        invoice = {
          ...common,
          id: orderId,
          type: 'my-individual',
          number: `${code}-EI-${compact}-${billSeq}`,
          randomCode: null,
          carrier: null,
          donationCode: null,
          buyer: { name: 'Contoh Teknologi Sdn Bhd', taxId: 'C1234567890', brn: '201901000123', address: 'Bangsar South, Kuala Lumpur', email: 'accounts@example.com' },
          period: date.slice(0, 7),
          status: 'issued',
          printed: false,
          provider: 'mock',
        }
      } else if (branch.country === 'SG' && invoiceRoll < 0.015) {
        invoice = {
          ...common,
          id: orderId,
          type: 'sg-tax-invoice',
          number: `${code}-TI-${compact}-${billSeq}`,
          randomCode: null,
          carrier: null,
          donationCode: null,
          buyer: { name: 'Example Consulting Pte Ltd', taxId: null, brn: null, address: 'Raffles Place, Singapore', email: 'finance@example.com' },
          period: date.slice(0, 7),
          status: 'issued',
          printed: true,
          provider: 'internal',
        }
      }
      if (invoice) emit('invoices', invoice.id, invoice)
    }

    // Feedback from the receipt QR on some bills.
    const fb = new Rng(`${party.rngSeed}|fb`)
    if (party.channel === 'dineIn' && fb.chance(0.08)) {
      const rating = fb.weighted<FeedbackDoc['rating']>([[5, 55], [4, 30], [3, 10], [2, 3], [1, 2]])
      const comments = FEEDBACK[party.language] ?? FEEDBACK.en
      const withComment = fb.chance(0.6)
      const which = rating >= 4 ? fb.int(0, 2) : rating === 3 ? 3 : fb.int(3, 4)
      const at = party.close + fb.int(20, 90) * MINUTE
      const feedback: FeedbackDoc = {
        id: `${orderId}-fb`,
        orderId,
        rating,
        comment: withComment ? comments[which]! : null,
        language: party.language,
        at: ts(at),
        businessDate: date,
        alerted: rating <= branch.settings.notifications.lowRatingAt,
        origin: 'seed',
      }
      if (at < until) feedbackUpTo.push(feedback)
      if (at < until && inWindow(at, window)) emit('feedback', feedback.id, feedback)
    }

    // Reservation for booked parties: written whenever the window moves its status on.
    if (party.reserved && party.guest) {
      const res = new Rng(`${party.rngSeed}|res`)
      const start = party.arrival - res.int(0, 2) * 5 * MINUTE
      const confirmed = res.chance(0.4)
      const now = reservationStatus(start, party.close, until, null, confirmed)
      const doc = reservationDoc(bw, plan, `r${compact}-${party.key}`, start, party.size, party.guest, party.language, now, party.tableIds, party.occasion)
      reservationsAt.push(doc)
      if (window.from === undefined || reservationStatus(start, party.close, window.from, null, confirmed) !== now) emit('reservations', doc.id, doc)
    }
  })

  // No-shows and cancellations.
  for (const extra of plan.extraReservations) {
    const status = reservationStatus(extra.start, null, until, extra.status, true)
    const doc = reservationDoc(bw, plan, `rx${compact}-${extra.key}`, extra.start, extra.size, extra.guest, extra.language, status, [], null)
    reservationsAt.push(doc)
    const before = window.from === undefined ? null : reservationStatus(extra.start, null, window.from, extra.status, true)
    if (before !== status) emit('reservations', doc.id, doc)
    if (status === 'noShow' && inWindow(extra.start + 20 * MINUTE, window)) visits.push({ customerId: extra.guest.id, branchId, at: extra.start, spend: 0, noShow: true })
  }

  // Cash drawer: one shift a day, counted at close (usually exact, sometimes a coin out).
  if (plan.open) {
    const sr = new Rng(`shift|${branchId}|${date}`)
    const hasPayOut = sr.chance(0.3)
    const payOutReason = sr.pick(['Ice and limes', 'Charcoal top-up', 'Market run for herbs'])
    const variance = sr.weighted<number>([[0, 80], [1, 8], [-1, 8], [-10, 4]])
    const opener = staffOnDuty(bw, date, 'cashier', 'lunch')[0]!
    const closer = staffOnDuty(bw, date, 'cashier', 'dinner')[0] ?? opener
    const openedAt = plan.open.start - 15 * MINUTE
    const float = money(t.float, currency)
    const payOutAt = plan.open.start + 4 * 60 * MINUTE
    const payOut = hasPayOut && payOutAt < until ? money(t.payOut, currency) : null
    const closedAt = lastClose + 15 * MINUTE
    const dayDone = until >= plan.dayEnd || (plan.parties.every((p) => p.close <= until) && closedAt <= until)
    if (payOut && inWindow(payOutAt, window)) {
      emit('cashMovements', `${shiftId}-out`, {
        id: `${shiftId}-out`,
        shiftId,
        kind: 'payOut',
        amount: payOut,
        reason: payOutReason,
        by: opener.id,
        approvedBy: manager.id,
        at: ts(payOutAt),
        businessDate: date,
        origin: 'seed',
      } satisfies CashMovementDoc)
    }
    const expected = subtract(add(float, cashIn), payOut ?? zero(currency))
    const coin = bw.profile.denominations.at(-1)!.value
    const counted = add(expected, money(variance * coin, currency))
    const countMap: Record<string, number> = {}
    let left = counted.amount
    for (const d of bw.profile.denominations) {
      const n = Math.floor(left / d.value)
      if (n > 0) countMap[String(d.value)] = n
      left -= n * d.value
    }
    const shift: ShiftDoc = {
      id: shiftId,
      openedBy: opener.id,
      openedAt: ts(openedAt),
      float,
      status: dayDone ? 'closed' : 'open',
      closedAt: dayDone ? ts(closedAt) : null,
      closedBy: dayDone ? closer.id : null,
      counted: dayDone ? countMap : null,
      countedTotal: dayDone ? counted : null,
      expected: dayDone ? expected : null,
      difference: dayDone ? subtract(counted, expected) : null,
      businessDate: date,
      origin: 'seed',
    }
    if ((openedAt < until && inWindow(openedAt, window)) || (dayDone && inWindow(Math.min(closedAt, until - 1), window))) emit('shifts', shiftId, shift)
  }

  // Timesheets. A relief cook who also covers another branch works there on Saturdays only.
  const timeEntries: TimeEntryDoc[] = []
  if (plan.open) {
    const saturday = weekdayOf(date) === 6
    bw.staff.forEach((person, index) => {
      const role = person.roles[branchId]!
      const relief = Object.keys(person.roles).length > 1
      if (relief && (person.homeBranchId === branchId ? saturday : !saturday)) return
      if (!onShift(person, branchId, date, bw.staffByRole[role].indexOf(person))) return
      const openAt = plan.open!.start
      const closeAt = plan.open!.end
      const mid = fromZoned(date, '16:30', tz).getTime()
      const clockIn = person.shift === 'pm' ? Math.max(openAt, mid - 30 * MINUTE) : openAt - (30 + (index % 3) * 5) * MINUTE
      const clockOut = person.shift === 'am' ? Math.min(closeAt, mid + 30 * MINUTE) : closeAt + (20 + (index % 4) * 5) * MINUTE
      if (clockIn >= until) return
      const done = clockOut <= until
      const minutes = done ? Math.round((clockOut - clockIn) / MINUTE) : null
      const entry: TimeEntryDoc = {
        id: `h${compact}-${person.id}`,
        staffId: person.id,
        in: ts(clockIn),
        out: done ? ts(clockOut) : null,
        minutes,
        businessDate: date,
        hourlyRate: money(hourlyRateFor(branchId, role), currency),
        flags: minutes !== null && minutes > branch.settings.labour.dailyLimitH * 60 ? ['overDailyLimit'] : [],
        origin: 'seed',
      }
      timeEntries.push(entry)
      if (inWindow(clockIn, window) || (done && inWindow(clockOut, window))) emit('timeEntries', entry.id, entry)
    })
  }

  // Purchasing: suppliers deliver on their days; goods received count as COGS.
  const purchases: number[] = []
  const weekday = weekdayOf(date)
  const receiveAt = fromZoned(date, '10:00', tz).getTime()
  if (receiveAt < until && plan.open) {
    const po = new Rng(`po|${branchId}|${date}`)
    const avg = averageUsage(world, branchId)
    bw.supplierSeeds.forEach((supplier, sIndex) => {
      if (!supplier.days.includes(weekday)) return
      const daysCovered = supplier.days.map((d) => (d - weekday + 7) % 7 || 7).sort((a, b) => a - b)[0]!
      const ids = bw.suppliers[sIndex]!.ingredientIds
      if (!ids.length) return
      const lines = ids.map((ingredientId) => ({
        ingredientId,
        qty: Math.max(1, Math.round((avg.get(ingredientId) ?? 0) * daysCovered * (0.95 + po.next() * 0.2))),
        unitCostMicro: bw.ingredientCostMicro[ingredientId] ?? 0,
      }))
      const totalMicro = lines.reduce((acc, l) => acc + l.qty * l.unitCostMicro, 0)
      const total = money(Number(divRound(BigInt(totalMicro), BigInt(MICRO), 'halfUp')), currency)
      purchases.push(total.amount)
      if (!inWindow(receiveAt, window)) return
      const id = `h${compact}-${supplier.id}`
      const inputTax =
        branch.country === 'TW'
          ? money(Number(divRound(BigInt(total.amount) * 5n, 105n, 'halfUp')), currency)
          : branch.country === 'SG'
            ? money(Number(divRound(BigInt(total.amount) * 9n, 109n, 'halfUp')), currency)
            : zero(currency)
      emit('purchaseOrders', id, {
        id,
        number: `PO-${code}-${compact}-${sIndex + 1}`,
        supplierId: supplier.id,
        status: 'received',
        lines,
        total,
        expectedOn: date,
        receivedAt: ts(receiveAt),
        supplierInvoice: { number: `INV-${compact}-${sIndex + 1}`, photo: null, inputTax },
        businessDate: date,
        createdBy: manager.id,
        origin: 'seed',
      } satisfies PurchaseOrderDoc)
      for (const line of lines) {
        emit('stockMovements', `${id}-${line.ingredientId}`, {
          id: `${id}-${line.ingredientId}`,
          ingredientId: line.ingredientId,
          delta: line.qty,
          reason: 'receive',
          ref: { type: 'purchaseOrder', id },
          unitCostMicro: line.unitCostMicro,
          note: null,
          at: ts(receiveAt),
          businessDate: date,
          by: manager.id,
          origin: 'seed',
        } satisfies StockMovementDoc)
      }
    })
  }

  // The day's sales deductions (one movement per ingredient) and waste, once the day is over.
  if (until >= plan.dayEnd && inWindow(plan.dayEnd - MINUTE, window)) {
    const at = plan.dayEnd - MINUTE
    for (const [ingredientId, qty] of [...usage.entries()].sort()) {
      emit('stockMovements', `h${compact}-sale-${ingredientId}`, {
        id: `h${compact}-sale-${ingredientId}`,
        ingredientId,
        delta: -qty,
        reason: 'sale',
        ref: { type: 'day', id: date },
        unitCostMicro: bw.ingredientCostMicro[ingredientId] ?? 0,
        note: null,
        at: ts(at),
        businessDate: date,
        by: 'system',
        origin: 'seed',
      } satisfies StockMovementDoc)
    }
    const waste = new Rng(`waste|${branchId}|${date}`)
    const perishable = bw.usedIngredients.filter((id) => ['produce', 'seafood'].includes(world.ingredients.find((i) => i.id === id)?.category ?? ''))
    const count = waste.int(1, 3)
    for (let i = 0; i < count && perishable.length; i++) {
      const ingredientId = waste.pick(perishable)
      const wasted = Math.max(1, Math.round((usage.get(ingredientId) ?? 20) * (0.02 + waste.next() * 0.03)))
      emit('stockMovements', `h${compact}-waste-${i}`, {
        id: `h${compact}-waste-${i}`,
        ingredientId,
        delta: -wasted,
        reason: 'waste',
        ref: null,
        unitCostMicro: bw.ingredientCostMicro[ingredientId] ?? 0,
        note: waste.pick(['Past its best', 'Dropped during prep', 'Over-prepped for service']),
        at: ts(plan.dayEnd - 2 * MINUTE),
        businessDate: date,
        by: bw.staffByRole.kitchen[0]?.id ?? manager.id,
        origin: 'seed',
      } satisfies StockMovementDoc)
    }
  }

  // Expenses on their days.
  for (const expense of expensesFor(bw, date)) {
    const at = fromZoned(date, '10:30', tz).getTime()
    if (at < until && inWindow(at, window)) emit('expenses', expense.id, { ...expense, createdAt: ts(at) })
  }

  const summary: DailySummary = {
    ...summarizeDay({
      branchId,
      businessDate: date,
      currency,
      timeZone: tz,
      orders: closedOrders,
      payments: closedPayments,
      refunds: [],
      timeEntries,
      feedback: feedbackUpTo,
      reservations: reservationsAt,
      purchases,
      unitCostMicro: bw.unitCostMicro,
    }),
    finalized: until >= plan.dayEnd,
    updatedAt: ts(Math.min(until, plan.dayEnd)),
    origin: 'seed',
  }
  emit('dailySummaries', date, summary)

  return { branchId, businessDate: date, docs, summary, visits, plannedBills: plan.parties.length, plannedTakeaways: plan.parties.filter((p) => p.channel === 'takeaway').length }
}

function reservationDoc(
  bw: BranchWorld,
  plan: DayPlan,
  id: string,
  start: number,
  size: number,
  guest: GuestSeed,
  language: Locale,
  status: ReservationStatus,
  tableIds: string[],
  occasion: ReservationDoc['occasion'],
): ReservationDoc {
  const rng = new Rng(`res|${bw.branch.id}|${id}`)
  const children = size >= 3 && rng.chance(0.2) ? 1 : 0
  const rule = bw.branch.settings.reservations.durations.find((d) => size <= d.maxParty) ?? bw.branch.settings.reservations.durations.at(-1)!
  const dinner = localTime(start, bw.branch.timeZone) >= bw.branch.settings.reservations.dinnerFrom
  const createdAt = start - rng.int(1, 14) * 86_400_000
  return {
    id,
    code: reservationCode(bw.branch.code, (n) => rng.int(0, n - 1)),
    tokenHash: rng.chars('0123456789abcdef', 64),
    customerId: guest.id,
    name: guest.name,
    phoneE164: guest.phoneE164,
    email: guest.email,
    party: { adults: size - children, children },
    startAt: ts(start),
    endAt: ts(start + (dinner ? rule.dinnerMin : rule.lunchMin) * MINUTE),
    businessDate: plan.date,
    localTime: localTime(start, bw.branch.timeZone),
    tableIds,
    status,
    source: rng.chance(0.7) ? 'online' : 'phone',
    occasion,
    notes: rng.chance(0.05) ? 'Window seat if possible' : null,
    allergies: rng.chance(0.06) ? rng.pick(['No peanuts', 'Shellfish allergy', 'Gluten-free please']) : null,
    dietary: rng.chance(0.05) ? ['vegetarian'] : [],
    seating: 'any',
    language,
    policyAccepted: { version: '2026-01', at: ts(createdAt) },
    deposit: null,
    createdAt: ts(createdAt),
    updatedAt: ts(Math.max(createdAt, Math.min(start, plan.dayEnd))),
    origin: 'seed',
  }
}

function expensesFor(bw: BranchWorld, date: string): Omit<ExpenseDoc, 'createdAt'>[] {
  const costs = monthlyCosts[bw.branch.id]!
  const day = Number(date.slice(8))
  const weekday = weekdayOf(date)
  const rng = new Rng(`exp|${bw.branch.id}|${date}`)
  const currency = bw.currency
  const items: [ExpenseCategory, number, string | null][] = []
  const jitter = (amount: number) => Math.round((amount * (95 + rng.int(0, 10))) / 100)
  if (day === 1) items.push(['rent', costs.rent, 'Landlord'])
  if (day === 5) items.push(['royalties', jitter(costs.royalties), 'Bara Group HQ'])
  if (day === 10) items.push(['utilities', jitter(costs.utilities), 'Electricity, water and gas'])
  if (day === 15) items.push(['marketing', jitter(costs.marketing), 'Social media and influencer dinners'])
  if (day === 28) items.push(['statutory', jitter(costs.statutory), 'Employer contributions'])
  if (weekday === 1) items.push(['gasCharcoal', jitter(costs.gasWeekly), 'Coconut-husk charcoal and LPG'])
  if (day === 7 || day === 21) items.push(['maintenance', jitter(costs.maintenance), rng.pick(['Grill hood cleaning', 'Refrigeration service', 'Plumbing'])])
  if (day === 18) items.push(['other', jitter(costs.other), 'Uniform laundry'])
  return items.map(([category, amount, supplier]) => ({
    id: `h${compactDate(date)}-${category}`,
    category,
    amount: money(amount, currency),
    inputTax: null,
    businessDate: date,
    month: date.slice(0, 7),
    supplier,
    receiptPhoto: null,
    note: null,
    by: bw.staffByRole.manager[0]!.id,
    origin: 'seed',
  }))
}

const usageCache = new Map<string, Map<string, number>>()

/** Average daily use per ingredient over a sample week, for par levels and purchase orders. */
export function averageUsage(world: World, branchId: string): Map<string, number> {
  const hit = usageCache.get(branchId)
  if (hit) return hit
  const totals = new Map<string, number>()
  const sampleWeek = Array.from({ length: 7 }, (_, i) => addDays('2026-09-28', i))
  for (const date of sampleWeek) {
    for (const party of planDay(world, branchId, date).parties) {
      for (const line of party.lines) {
        if (line.status === 'voided') continue
        for (const r of line.recipe) totals.set(r.ingredientId, (totals.get(r.ingredientId) ?? 0) + (r.qty * line.qty) / sampleWeek.length)
      }
    }
  }
  usageCache.set(branchId, totals)
  return totals
}

/** Today's reservations for future days (shown as booked/confirmed until they happen). */
export function futureReservations(world: World, branchId: string, date: string): SeedDoc[] {
  return generateDay(world, branchId, date, { until: planDay(world, branchId, date).dayStart }).docs.filter((d) => d.path.includes('/reservations/'))
}

export const addDaysTo = addDays
