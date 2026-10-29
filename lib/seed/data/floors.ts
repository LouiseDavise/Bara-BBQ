// Floor plans. Each area lists its tables as [label, seats] and lays them out on a grid; tables
// next to each other in the same row can be combined for larger parties.
import type { LocalizedText } from '../../../shared/localized.js'
import type { AreaDoc, TableDoc } from '../../../shared/types/floor.js'
import { L } from './text.js'

interface AreaSeed {
  id: string
  kind: AreaDoc['kind']
  name: LocalizedText
  /** [label, seats]; seats ≤ 2 → small round table; counter areas get counter seats. */
  tables: [string, number][]
  perRow: number
  /** Combinable with the neighbour in the same row. */
  combinable: boolean
  bookable: boolean
}

const AREA_NAMES = {
  main: L('Main dining', '主用餐區', '主用餐区', 'Ruang utama', 'Ruang makan utama', 'メインダイニング', '메인 홀'),
  counter: L('Chef’s counter', '主廚吧檯', '主厨吧台', 'Meja chef', 'Kaunter chef', 'シェフズカウンター', '셰프 카운터'),
  private: L('Private room', '包廂', '包间', 'Ruang privat', 'Bilik peribadi', '個室', '프라이빗 룸'),
  terrace: L('Terrace', '露台', '露台', 'Teras', 'Teres', 'テラス', '테라스'),
  bar: L('Bar high-tops', '吧台高桌', '吧台高桌', 'Meja tinggi bar', 'Meja tinggi bar', 'バーのハイテーブル', '바 하이테이블'),
  garden: L('Garden', '花園', '花园', 'Taman', 'Taman', 'ガーデン', '정원'),
  indoor: L('Indoor', '室內', '室内', 'Dalam ruangan', 'Dalam bangunan', '屋内', '실내'),
  sunset: L('Sunset bar', '夕陽酒吧', '夕阳酒吧', 'Bar senja', 'Bar senja', 'サンセットバー', '선셋 바'),
  booths: L('Window booths', '窗邊卡座', '窗边卡座', 'Bilik dekat jendela', 'Ruang tepi tingkap', '窓際ブース', '창가 부스'),
  upstairs: L('Upstairs', '二樓', '二楼', 'Lantai atas', 'Tingkat atas', '2階', '2층'),
}

const t = (prefix: string, seats: number[], start = 1): [string, number][] => seats.map((s, i) => [`${prefix}${start + i}`, s])
const repeat = (count: number, seats: number) => Array.from({ length: count }, () => seats)

const FLOORS: Record<string, AreaSeed[]> = {
  // 22 tables, 70 covers: chef's counter, private room
  tpe: [
    { id: 'main', kind: 'indoor', name: AREA_NAMES.main, tables: t('', [...repeat(9, 2), ...repeat(8, 4)]), perRow: 6, combinable: true, bookable: true },
    { id: 'counter', kind: 'counter', name: AREA_NAMES.counter, tables: t('C', repeat(4, 2)), perRow: 4, combinable: true, bookable: true },
    { id: 'private', kind: 'private', name: AREA_NAMES.private, tables: [['P1', 12]], perRow: 1, combinable: false, bookable: true },
  ],
  // 30 tables, ~120 covers: terrace, private room, bar
  jkt: [
    { id: 'main', kind: 'indoor', name: AREA_NAMES.main, tables: t('', [...repeat(6, 2), ...repeat(7, 4), ...repeat(3, 6)]), perRow: 6, combinable: true, bookable: true },
    { id: 'terrace', kind: 'terrace', name: AREA_NAMES.terrace, tables: t('T', [...repeat(4, 2), ...repeat(6, 4)]), perRow: 5, combinable: true, bookable: true },
    { id: 'private', kind: 'private', name: AREA_NAMES.private, tables: t('P', [10, 10]), perRow: 2, combinable: true, bookable: true },
    { id: 'bar', kind: 'bar', name: AREA_NAMES.bar, tables: t('B', [4, 4]), perRow: 2, combinable: false, bookable: false },
  ],
  // 26 tables, 90 covers: garden, sunset bar
  dps: [
    { id: 'garden', kind: 'garden', name: AREA_NAMES.garden, tables: t('G', [...repeat(4, 2), ...repeat(6, 4), ...repeat(2, 6)]), perRow: 6, combinable: true, bookable: true },
    { id: 'indoor', kind: 'indoor', name: AREA_NAMES.indoor, tables: t('', [...repeat(4, 2), ...repeat(4, 4)]), perRow: 4, combinable: true, bookable: true },
    { id: 'sunset', kind: 'bar', name: AREA_NAMES.sunset, tables: t('S', [...repeat(5, 4), 2]), perRow: 6, combinable: false, bookable: false },
  ],
  // 24 tables, 82 covers: private room
  kul: [
    { id: 'main', kind: 'indoor', name: AREA_NAMES.main, tables: t('', [...repeat(9, 2), ...repeat(10, 4)]), perRow: 7, combinable: true, bookable: true },
    { id: 'booths', kind: 'indoor', name: AREA_NAMES.booths, tables: t('W', repeat(4, 4)), perRow: 4, combinable: false, bookable: true },
    { id: 'private', kind: 'private', name: AREA_NAMES.private, tables: [['P1', 8]], perRow: 1, combinable: false, bookable: true },
  ],
  // 14 tables, 50 covers: chef's counter, upstairs room
  sin: [
    { id: 'counter', kind: 'counter', name: AREA_NAMES.counter, tables: t('C', repeat(6, 2)), perRow: 6, combinable: true, bookable: true },
    { id: 'main', kind: 'indoor', name: AREA_NAMES.main, tables: t('', [2, ...repeat(6, 4)]), perRow: 4, combinable: true, bookable: true },
    { id: 'upstairs', kind: 'private', name: AREA_NAMES.upstairs, tables: [['U1', 12]], perRow: 1, combinable: false, bookable: true },
  ],
}

export function floorFor(branchId: string): { areas: AreaDoc[]; tables: TableDoc[] } {
  const seeds = FLOORS[branchId]
  if (!seeds) throw new Error(`No floor plan for ${branchId}.`)
  const areas: AreaDoc[] = []
  const tables: TableDoc[] = []
  let y = 0
  seeds.forEach((area, areaIndex) => {
    areas.push({ id: area.id, name: area.name, kind: area.kind, sort: areaIndex + 1, origin: 'seed' })
    const rows = Math.ceil(area.tables.length / area.perRow)
    area.tables.forEach(([label, seats], index) => {
      const row = Math.floor(index / area.perRow)
      const col = index % area.perRow
      const wide = seats >= 6
      const id = `${area.id}-${label.toLowerCase()}`
      const neighbours: string[] = []
      if (area.combinable) {
        const left = area.tables[index - 1]
        const right = area.tables[index + 1]
        if (left && col > 0) neighbours.push(`${area.id}-${left[0].toLowerCase()}`)
        if (right && col < area.perRow - 1) neighbours.push(`${area.id}-${right[0].toLowerCase()}`)
      }
      tables.push({
        id,
        label,
        areaId: area.id,
        shape: area.kind === 'counter' ? 'counter' : seats <= 2 ? 'round' : area.id === 'booths' ? 'booth' : wide ? 'rect' : 'square',
        seats: { min: seats <= 2 ? 1 : Math.max(2, seats - 2), max: seats },
        layout: { x: col * 3, y: y + row * 3, w: wide ? 3 : 2, h: 2, rotation: 0 },
        combinableWith: neighbours,
        onlineBookable: area.bookable,
        qrVersion: 1,
        live: { status: 'free', sessionId: null, since: null },
        origin: 'seed',
      })
    })
    y += rows * 3 + 2
  })
  return { areas, tables }
}
