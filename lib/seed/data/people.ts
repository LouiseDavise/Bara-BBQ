// Staff for every role in every branch, group-level users, suppliers, and the name pools the
// guest generator draws from. All names and numbers are fictional.
import type { LocalCurrency } from '../../../shared/currencies.js'
import type { Locale } from '../../../shared/locales.js'
import type { BranchRole, GroupRole } from '../../../shared/permissions.js'

export interface StaffSeed {
  id: string
  name: string
  /** Role per branch; most staff work in one branch, a few in two. */
  roles: Record<string, BranchRole>
  homeBranchId: string
  language: 'zh-TW' | 'zh-CN' | 'en' | 'id' | 'ms'
  /** Shift pattern for the generated timesheets. */
  shift: 'am' | 'pm' | 'full'
}

export interface GroupUserSeed {
  id: string
  name: string
  username: string
  groupRole: GroupRole
  areaBranches: string[]
  language: StaffSeed['language']
  homeBranchId: string | null
}

const branchStaff = (branchId: string, language: StaffSeed['language'], people: [string, BranchRole, StaffSeed['shift']][]): StaffSeed[] =>
  people.map(([name, role, shift], i) => ({ id: `${branchId}-${String(i + 1).padStart(2, '0')}`, name, roles: { [branchId]: role }, homeBranchId: branchId, language, shift }))

export const staffSeeds: StaffSeed[] = [
  ...branchStaff('tpe', 'zh-TW', [
    ['林佳慧', 'manager', 'full'],
    ['陳冠廷', 'cashier', 'am'],
    ['張雅筑', 'cashier', 'pm'],
    ['王柏翰', 'waiter', 'am'],
    ['李宜蓁', 'waiter', 'pm'],
    ['黃品睿', 'waiter', 'pm'],
    ['吳欣妤', 'waiter', 'am'],
    ['劉建宏', 'kitchen', 'full'],
    ['蔡明哲', 'kitchen', 'am'],
    ['鄭家豪', 'kitchen', 'pm'],
    ['許文傑', 'kitchen', 'pm'],
    ['楊詩涵', 'host', 'pm'],
  ]),
  ...branchStaff('jkt', 'id', [
    ['Andi Wijaya', 'manager', 'full'],
    ['Siti Rahmawati', 'cashier', 'am'],
    ['Dewi Lestari', 'cashier', 'pm'],
    ['Rizky Hidayat', 'waiter', 'am'],
    ['Putri Ayu', 'waiter', 'pm'],
    ['Fajar Nugraha', 'waiter', 'pm'],
    ['Bayu Saputra', 'waiter', 'am'],
    ['Nadia Putri', 'waiter', 'pm'],
    ['Agus Setiawan', 'kitchen', 'full'],
    ['Budi Santoso', 'kitchen', 'am'],
    ['Hendra Gunawan', 'kitchen', 'pm'],
    ['Eko Prasetyo', 'kitchen', 'pm'],
    ['Maya Sari', 'host', 'pm'],
  ]),
  ...branchStaff('dps', 'id', [
    ['Made Ayu Wulandari', 'manager', 'full'],
    ['Komang Ari', 'cashier', 'am'],
    ['Kadek Dwi', 'cashier', 'pm'],
    ['Wayan Sudarta', 'waiter', 'am'],
    ['Nyoman Arta', 'waiter', 'pm'],
    ['Putu Gede', 'waiter', 'pm'],
    ['Ketut Sari', 'waiter', 'am'],
    ['Luh Putu', 'waiter', 'pm'],
    ['Gede Surya', 'kitchen', 'full'],
    ['Wayan Eka', 'kitchen', 'am'],
    ['Made Rai', 'kitchen', 'pm'],
    ['Kadek Ayu', 'host', 'pm'],
  ]),
  ...branchStaff('kul', 'ms', [
    ['Nurul Aina', 'manager', 'full'],
    ['Tan Wei Ling', 'cashier', 'am'],
    ['Farah Hanim', 'cashier', 'pm'],
    ['Muhammad Hafiz', 'waiter', 'am'],
    ['Arif Zulkifli', 'waiter', 'pm'],
    ['Priya Devi', 'waiter', 'pm'],
    ['Lim Jia Hui', 'waiter', 'am'],
    ['Amirul Hakim', 'waiter', 'pm'],
    ['Rajesh Kumar', 'kitchen', 'full'],
    ['Lee Kah Meng', 'kitchen', 'am'],
    ['Ahmad Faizal', 'kitchen', 'pm'],
    ['Aisyah Rahman', 'host', 'pm'],
  ]),
  ...branchStaff('sin', 'en', [
    ['Daniel Tan', 'manager', 'full'],
    ['Jasmine Lim', 'cashier', 'full'],
    ['Marcus Lee', 'waiter', 'am'],
    ['Siti Aminah', 'waiter', 'pm'],
    ['Ryan Goh', 'waiter', 'full'],
    ['Priya Nair', 'kitchen', 'full'],
    ['Hafiz Ismail', 'kitchen', 'am'],
    ['Chen Wei Jie', 'kitchen', 'pm'],
    ['Chloe Ng', 'host', 'pm'],
  ]),
]

// A relief chef who covers Bali as well as Jakarta, to show one person with roles in two branches.
const relief = staffSeeds.find((s) => s.name === 'Hendra Gunawan')!
relief.roles.dps = 'kitchen'

export const groupUsers: GroupUserSeed[] = [
  { id: 'hq-owner', name: 'Raka Pratama', username: 'owner', groupRole: 'owner', areaBranches: [], language: 'en', homeBranchId: null },
  { id: 'hq-area-id', name: 'Dian Kusuma', username: 'area.id', groupRole: 'area', areaBranches: ['jkt', 'dps'], language: 'id', homeBranchId: null },
  { id: 'hq-area-mysg', name: 'Melissa Teo', username: 'area.mysg', groupRole: 'area', areaBranches: ['kul', 'sin'], language: 'en', homeBranchId: null },
  { id: 'hq-finance', name: '許美玲', username: 'finance', groupRole: 'finance', areaBranches: [], language: 'zh-TW', homeBranchId: null },
  { id: 'hq-menu', name: 'Ayu Paramitha', username: 'menu', groupRole: 'menuEditor', areaBranches: [], language: 'id', homeBranchId: null },
]

/**
 * Fully loaded cost per hour by role (wage plus allowances, meals and bonuses; employer
 * contributions are booked separately as a 'statutory' expense), in minor units.
 */
export const hourlyRates: Record<string, Record<BranchRole, number>> = {
  tpe: { manager: 520, cashier: 300, waiter: 290, kitchen: 340, host: 290 },
  jkt: { manager: 140_000, cashier: 75_000, waiter: 70_000, kitchen: 85_000, host: 70_000 },
  dps: { manager: 130_000, cashier: 70_000, waiter: 65_000, kitchen: 80_000, host: 65_000 },
  kul: { manager: 4_500, cashier: 2_200, waiter: 2_000, kitchen: 2_600, host: 2_000 },
  sin: { manager: 3_800, cashier: 2_100, waiter: 2_000, kitchen: 2_400, host: 2_000 },
}

export interface SupplierSeed {
  id: string
  name: string
  contact: string
  phoneE164: string
  /** Ingredient categories the supplier covers. */
  covers: ('meat' | 'seafood' | 'produce' | 'dry' | 'dairy' | 'beverage' | 'alcohol')[]
  /** Delivery days, 0 = Sunday. */
  days: number[]
}

export const suppliers: Record<string, SupplierSeed[]> = {
  tpe: [
    { id: 'tpe-sea', name: 'Keelung Harbour Seafood Co.', contact: '江先生', phoneE164: '+886224286611', covers: ['seafood'], days: [1, 3, 5] },
    { id: 'tpe-veg', name: 'Da’an Fresh Produce', contact: '周小姐', phoneE164: '+886227081122', covers: ['produce'], days: [2, 4, 6] },
    { id: 'tpe-meat', name: 'Formosa Meat & Poultry', contact: '蘇先生', phoneE164: '+886229981133', covers: ['meat', 'dairy'], days: [1, 4] },
    { id: 'tpe-pantry', name: 'Nusantara Pantry Imports (Taiwan)', contact: 'Sari Hartono', phoneE164: '+886225551144', covers: ['dry', 'beverage'], days: [3] },
    { id: 'tpe-bev', name: 'Taipei Beverage Supply', contact: '林先生', phoneE164: '+886225371155', covers: ['alcohol'], days: [5] },
  ],
  jkt: [
    { id: 'jkt-sea', name: 'PT Laut Segar Nusantara', contact: 'Pak Rudi', phoneE164: '+6281311122201', covers: ['seafood'], days: [1, 3, 5] },
    { id: 'jkt-veg', name: 'CV Sayur Lembang', contact: 'Ibu Wati', phoneE164: '+6281311122202', covers: ['produce'], days: [2, 4, 6] },
    { id: 'jkt-meat', name: 'PT Daging Prima Jakarta', contact: 'Pak Joko', phoneE164: '+6281311122203', covers: ['meat', 'dairy'], days: [1, 4] },
    { id: 'jkt-pantry', name: 'PT Dapur Nusantara', contact: 'Ibu Lina', phoneE164: '+6281311122204', covers: ['dry', 'beverage'], days: [3] },
    { id: 'jkt-bev', name: 'PT Minuman Sejahtera', contact: 'Pak Dimas', phoneE164: '+6281311122205', covers: ['alcohol'], days: [5] },
  ],
  dps: [
    { id: 'dps-sea', name: 'Koperasi Nelayan Jimbaran', contact: 'Pak Ketut', phoneE164: '+6281999022201', covers: ['seafood'], days: [1, 2, 3, 4, 5, 6] },
    { id: 'dps-veg', name: 'Bedugul Farm Fresh', contact: 'Ibu Komang', phoneE164: '+6281999022202', covers: ['produce'], days: [1, 3, 5] },
    { id: 'dps-meat', name: 'CV Daging Bali Prima', contact: 'Pak Made', phoneE164: '+6281999022203', covers: ['meat', 'dairy'], days: [2, 5] },
    { id: 'dps-pantry', name: 'PT Dapur Nusantara (Bali)', contact: 'Ibu Ayu', phoneE164: '+6281999022204', covers: ['dry', 'beverage'], days: [3] },
    { id: 'dps-bev', name: 'CV Arak & Minuman Bali', contact: 'Pak Nyoman', phoneE164: '+6281999022205', covers: ['alcohol'], days: [4] },
  ],
  kul: [
    { id: 'kul-sea', name: 'Pasar Borong Seafood Sdn Bhd', contact: 'Encik Rahim', phoneE164: '+60123331101', covers: ['seafood'], days: [1, 3, 5] },
    { id: 'kul-veg', name: 'Cameron Highlands Greens Sdn Bhd', contact: 'Puan Lim', phoneE164: '+60123331102', covers: ['produce'], days: [2, 4, 6] },
    { id: 'kul-meat', name: 'Halal Prime Meats Sdn Bhd', contact: 'Encik Azman', phoneE164: '+60123331103', covers: ['meat', 'dairy'], days: [1, 4] },
    { id: 'kul-pantry', name: 'Rempah Ratus Trading', contact: 'Puan Kavitha', phoneE164: '+60123331104', covers: ['dry', 'beverage'], days: [3] },
  ],
  sin: [
    { id: 'sin-sea', name: 'Jurong Fishery Supplies Pte Ltd', contact: 'Mr Goh', phoneE164: '+6581230001', covers: ['seafood'], days: [1, 3, 5] },
    { id: 'sin-veg', name: 'Pasir Panjang Greens Pte Ltd', contact: 'Ms Yeo', phoneE164: '+6581230002', covers: ['produce'], days: [2, 4, 6] },
    { id: 'sin-meat', name: 'Tiong Bahru Meats Pte Ltd', contact: 'Mr Rahman', phoneE164: '+6581230003', covers: ['meat', 'dairy'], days: [1, 4] },
    { id: 'sin-pantry', name: 'Archipelago Pantry Pte Ltd', contact: 'Ms Devi', phoneE164: '+6581230004', covers: ['dry', 'beverage'], days: [3] },
    { id: 'sin-bev', name: 'Keong Saik Cellars Pte Ltd', contact: 'Mr Lau', phoneE164: '+6581230005', covers: ['alcohol'], days: [5] },
  ],
}

/** Guest name pools by where the guest comes from; each pool has its phone country and language. */
export interface GuestPool {
  names: string[]
  /** Phone prefix and digits to append, e.g. ['+8869', 8]. */
  phone: [string, number]
  language: Locale
  country: 'TW' | 'ID' | 'MY' | 'SG' | 'JP' | 'KR' | 'CN' | 'AU'
  tourist: boolean
}

export const guestPools: Record<string, GuestPool> = {
  tw: { names: ['陳怡君', '林志明', '王雅婷', '張家豪', '李佳穎', '黃冠宇', '吳宗翰', '劉欣怡', '蔡承恩', '楊淑芬', '許志豪', '鄭宇翔', '謝佩珊', '郭俊廷', '洪雅琪', '曾柏宇'], phone: ['+8869', 8], language: 'zh-TW', country: 'TW', tourist: false },
  id: { names: ['Rina Wijaya', 'Arief Hidayat', 'Dian Permata', 'Bimo Prakoso', 'Lestari Ningsih', 'Taufik Hakim', 'Indah Sari', 'Yoga Pratama', 'Citra Dewi', 'Hendra Kurniawan', 'Wulan Sari', 'Reza Mahendra', 'Ratna Sari', 'Ilham Fauzi'], phone: ['+628', 10], language: 'id', country: 'ID', tourist: false },
  my: { names: ['Nur Izzati', 'Hakim Rosli', 'Tan Mei Ling', 'Kavitha Raj', 'Faizal Hamid', 'Wong Kar Weng', 'Siti Hajar', 'Arjun Pillai', 'Liyana Aziz', 'Chong Wei Ming', 'Haziq Iskandar', 'Mei Yee Ong'], phone: ['+601', 8], language: 'en', country: 'MY', tourist: false },
  sg: { names: ['Grace Lim', 'Benjamin Tan', 'Nur Aisyah', 'Rajesh Menon', 'Amanda Wong', 'Joel Ng', 'Huiling Chua', 'Faris Rahman', 'Sarah Koh', 'Wei Ming Lee', 'Kavya Iyer', 'Darren Teo'], phone: ['+659', 7], language: 'en', country: 'SG', tourist: false },
  jp: { names: ['Yuki Tanaka', 'Haruto Sato', 'Aoi Suzuki', 'Ren Takahashi', 'Mei Watanabe', 'Sota Ito', 'Hina Yamamoto', 'Kaito Nakamura'], phone: ['+8190', 8], language: 'ja', country: 'JP', tourist: true },
  kr: { names: ['Kim Minji', 'Lee Jihoon', 'Park Seoyeon', 'Choi Junho', 'Jung Yuna', 'Kang Minseo', 'Yoon Dohyun', 'Han Jiwoo'], phone: ['+8210', 8], language: 'ko', country: 'KR', tourist: true },
  cn: { names: ['王芳', '李伟', '张敏', '刘洋', '陈静', '杨帆', '赵磊', '周婷'], phone: ['+86138', 8], language: 'zh-CN', country: 'CN', tourist: true },
  au: { names: ['Olivia Brown', 'Jack Wilson', 'Chloe Taylor', 'Liam Johnson', 'Emily Smith', 'Noah Williams', 'Mia Jones', 'Lucas Martin', 'Ruby Anderson', 'Oscar Walker'], phone: ['+614', 8], language: 'en', country: 'AU', tourist: true },
}

/** Which pools each branch's guests come from, with weights. */
export const guestMix: Record<string, [keyof typeof guestPools, number][]> = {
  tpe: [['tw', 80], ['jp', 8], ['kr', 6], ['id', 3], ['au', 3]],
  jkt: [['id', 82], ['cn', 6], ['au', 6], ['sg', 6]],
  dps: [['au', 34], ['id', 18], ['jp', 14], ['kr', 14], ['cn', 14], ['sg', 6]],
  kul: [['my', 86], ['id', 6], ['sg', 4], ['cn', 4]],
  sin: [['sg', 74], ['cn', 8], ['my', 8], ['id', 5], ['au', 5]],
}

/** Currency of each branch, for convenience in the generator. */
export const branchCurrency: Record<string, LocalCurrency> = { tpe: 'TWD', jkt: 'IDR', dps: 'IDR', kul: 'MYR', sin: 'SGD' }
