// Which master items each branch sells, its local specials, and local price rules.
import type { LocalizedText } from '../../../shared/localized.js'
import type { Dietary, RecipeLine } from '../../../shared/types/menu.js'
import type { DayKey } from '../../../shared/time/opening-hours.js'
import { L } from './text.js'

/** Master items each branch leaves off its menu. */
export const excluded: Record<string, string[]> = {
  tpe: ['urap_sayur', 'plecing_kangkung', 'kopi_tubruk', 'nasi_uduk', 'lumpia_udang', 'ikan_colo_colo'],
  jkt: ['salmon_matah', 'kopi_martini', 'urap_sayur', 'lumpia_udang', 'dadar_gulung', 'wedang_jahe'],
  dps: ['sate_maranggi', 'rendang_asap', 'mie_goreng', 'nasi_uduk', 'urap_sayur', 'kopi_tubruk', 'wedang_jahe', 'dadar_gulung', 'lumpia_udang', 'terong_balado'],
  // KL is halal-certified with no alcohol: alcoholic items are excluded by the menu rules too.
  kul: ['bebek_bakar', 'plecing_kangkung', 'kopi_tubruk'],
  sin: [
    'ayam_betutu',
    'iga_kambing',
    'rendang_asap',
    'ikan_colo_colo',
    'gado_gado',
    'terong_balado',
    'plecing_kangkung',
    'urap_sayur',
    'nasi_uduk',
    'mie_goreng',
    'dadar_gulung',
    'wedang_jahe',
    'kopi_tubruk',
    'es_kelapa',
  ],
}

/** Bali prices sit ~10% above Jakarta's, rounded to Rp 5.000. */
export function localPrice(branchId: string, suggested: number): number {
  if (branchId === 'dps') return Math.round((suggested * 11) / 10 / 5_000) * 5_000
  return suggested
}

/** Chef's picks per branch (master item IDs). */
export const chefsPicks: Record<string, string[]> = {
  tpe: ['iga_bakar', 'ikan_jimbaran', 'jamu_spritz'],
  jkt: ['iga_bakar', 'sate_maranggi', 'es_kopi'],
  dps: ['ikan_jimbaran', 'sate_lilit', 'jamu_spritz'],
  kul: ['iga_bakar', 'sayur_matah', 'es_kopi'],
  sin: ['iga_bakar', 'sate_lilit', 'jamu_spritz'],
}

/** Items only sold at certain times, e.g. lunch only. */
export const availability: Record<string, Record<string, { days: DayKey[]; from: string; to: string }[]>> = {
  sin: { nasi_bakar: [{ days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], from: '11:30', to: '14:30' }] },
  kul: { nasi_uduk: [{ days: ['sat', 'sun'], from: '10:30', to: '14:00' }] },
}

export interface SpecialSeed {
  id: string
  branchId: string
  categoryId: string
  name: LocalizedText
  description: LocalizedText
  allergenIds: string[]
  dietary: Dietary
  spice: { adjustable: boolean; default: number } | null
  modifierGroupIds: string[]
  recipe: RecipeLine[]
  price: number
  station: string
}

const diet = (extra: Partial<Dietary> = {}): Dietary => {
  const d = { halalSuitable: true, vegetarian: false, vegan: false, containsAlcohol: false, ...extra }
  if (d.containsAlcohol) d.halalSuitable = false
  return d
}
const r = (...lines: [string, number][]): RecipeLine[] => lines.map(([ingredientId, qty]) => ({ ingredientId, qty }))

export const specials: SpecialSeed[] = [
  {
    id: 'tpe_sakura_rice',
    branchId: 'tpe',
    categoryId: 'rice',
    name: L('Sakura shrimp smoked fried rice', '櫻花蝦煙燻炒飯', '樱花虾烟熏炒饭', 'Nasi goreng asap udang sakura', 'Nasi goreng salai udang sakura', '桜えびのスモークチャーハン', '사쿠라 새우 훈연 볶음밥'),
    description: L(
      'Smoked rice fried with Donggang sakura shrimp and egg.',
      '東港櫻花蝦與蛋炒煙燻米飯。',
      '东港樱花虾与鸡蛋炒烟熏米饭。',
      'Nasi asap digoreng dengan udang sakura Donggang dan telur.',
      'Nasi salai digoreng dengan udang sakura Donggang dan telur.',
      '東港の桜えびと卵で炒めたスモークライス。',
      '동강 사쿠라 새우와 달걀로 볶은 훈연 밥.',
    ),
    allergenIds: ['crustacean', 'egg'],
    dietary: diet(),
    spice: { adjustable: true, default: 0 },
    modifierGroupIds: ['spice'],
    recipe: r(['jasmine_rice', 180], ['prawn', 30], ['egg', 1], ['shallot', 15]),
    price: 420,
    station: 'hot',
  },
  {
    id: 'tpe_oolong_duck',
    branchId: 'tpe',
    categoryId: 'grill',
    name: L('Oolong-smoked duck leg', '烏龍茶燻鴨腿', '乌龙茶熏鸭腿', 'Paha bebek asap teh oolong', 'Peha itik salai teh oolong', '烏龍茶燻しの鴨もも', '우롱차 훈연 오리 다리'),
    description: L(
      'Duck leg smoked over Taiwanese oolong leaves, glazed with sweet soy.',
      '以台灣烏龍茶葉燻製的鴨腿，刷上甜醬油。',
      '用台湾乌龙茶叶熏制的鸭腿，刷上甜酱油。',
      'Paha bebek diasap dengan daun teh oolong Taiwan, diolesi kecap manis.',
      'Peha itik disalai dengan daun teh oolong Taiwan, disapu kicap manis.',
      '台湾烏龍茶の茶葉で燻した鴨ももに甘口醤油を塗って。',
      '대만 우롱차 잎으로 훈연하고 달콤한 간장을 바른 오리 다리.',
    ),
    allergenIds: ['soy'],
    dietary: diet(),
    spice: null,
    modifierGroupIds: ['addons'],
    recipe: r(['duck_leg', 1], ['tea', 8], ['kecap_manis', 20]),
    price: 640,
    station: 'grill',
  },
  {
    id: 'tpe_baozhong_sour',
    branchId: 'tpe',
    categoryId: 'cocktails',
    name: L('Baozhong arak sour', '包種茶亞力酸酒', '包种茶亚力酸酒', 'Arak sour teh Baozhong', 'Arak sour teh Baozhong', '包種茶のアラック・サワー', '포종차 아락 사워'),
    description: L(
      'Arak infused with Pinglin baozhong tea, lime and palm sugar.',
      '坪林包種茶浸泡的亞力酒，加萊姆與椰糖。',
      '坪林包种茶浸泡的亚力酒，加青柠和椰糖。',
      'Arak rendaman teh Baozhong Pinglin, jeruk nipis, dan gula aren.',
      'Arak rendaman teh Baozhong Pinglin, limau dan gula melaka.',
      '坪林の包種茶を漬け込んだアラックにライムとパームシュガー。',
      '핑린 포종차를 우린 아락에 라임과 야자당.',
    ),
    allergenIds: [],
    dietary: diet({ vegetarian: true, vegan: true, containsAlcohol: true }),
    spice: null,
    modifierGroupIds: [],
    recipe: r(['arak', 50], ['tea', 4], ['lime', 20], ['palm_sugar', 15]),
    price: 420,
    station: 'bar',
  },
  {
    id: 'jkt_sop_buntut',
    branchId: 'jkt',
    categoryId: 'grill',
    name: L('Grilled oxtail soup', '炭烤牛尾湯', '炭烤牛尾汤', 'Sop buntut bakar', 'Sup ekor bakar', 'ソプ・ブントゥット（焼きオックステールスープ）', '숩 분뚯 (구운 소꼬리 수프)'),
    description: L(
      'Jakarta’s favourite: charred oxtail in a clear clove-scented broth.',
      '雅加達最愛：炭烤牛尾配丁香清湯。',
      '雅加达最爱：炭烤牛尾配丁香清汤。',
      'Favorit Jakarta: buntut sapi bakar dalam kuah bening beraroma cengkih.',
      'Kegemaran Jakarta: ekor lembu bakar dalam sup jernih beraroma cengkih.',
      'ジャカルタの定番。焼いたオックステールとクローブ香るスープ。',
      '자카르타의 인기 메뉴: 정향 향 맑은 국물에 구운 소꼬리.',
    ),
    allergenIds: [],
    dietary: diet(),
    spice: null,
    modifierGroupIds: ['addons'],
    recipe: r(['beef_chuck', 300], ['shallot', 20], ['garlic', 10]),
    price: 185_000,
    station: 'grill',
  },
  {
    id: 'jkt_kerak_telor',
    branchId: 'jkt',
    categoryId: 'sate',
    name: L('Kerak telor', '貝塔維蛋餅', '贝塔维蛋饼', 'Kerak telor', 'Kerak telur', 'クラッ・トロール（卵とご飯のおこげ）', '끄락 뜰로르 (달걀 누룽지)'),
    description: L(
      'Betawi street classic: egg and rice crust with dried shrimp and fried shallot.',
      '雅加達老街小吃：蛋與米脆餅，加蝦米與油蔥。',
      '雅加达老街小吃：蛋与米脆饼，加虾米和油葱。',
      'Jajanan khas Betawi: kerak nasi dan telur dengan ebi dan bawang goreng.',
      'Makanan jalanan Betawi: kerak nasi dan telur dengan udang kering dan bawang goreng.',
      'ブタウィの屋台名物。卵とご飯のおこげに干しエビと揚げエシャロット。',
      '브타위 길거리 명물: 건새우와 튀긴 샬롯을 올린 달걀 누룽지.',
    ),
    allergenIds: ['egg', 'crustacean'],
    dietary: diet(),
    spice: null,
    modifierGroupIds: [],
    recipe: r(['jasmine_rice', 80], ['egg', 2], ['shrimp_paste', 3], ['shallot', 10]),
    price: 55_000,
    station: 'hot',
  },
  {
    id: 'jkt_selendang',
    branchId: 'jkt',
    categoryId: 'dessert',
    name: L('Es selendang mayang', '彩虹椰奶凍', '彩虹椰奶冻', 'Es selendang mayang', 'Ais selendang mayang', 'エス・スレンダン・マヤン（虹色ゼリーのデザート）', '에스 슬렌당 마양 (무지개 젤리 디저트)'),
    description: L(
      'Layered rice-flour jelly with coconut milk and palm sugar syrup.',
      '層層米粉凍，淋椰奶與椰糖糖漿。',
      '层层米粉冻，淋椰奶和椰糖糖浆。',
      'Kue lapis tepung beras dengan santan dan sirup gula aren.',
      'Kuih lapis tepung beras dengan santan dan sirap gula melaka.',
      '層になった米粉ゼリーにココナッツミルクとパームシュガーシロップ。',
      '쌀가루 젤리에 코코넛 밀크와 야자당 시럽.',
    ),
    allergenIds: [],
    dietary: diet({ vegetarian: true, vegan: true }),
    spice: null,
    modifierGroupIds: [],
    recipe: r(['rice_flour', 60], ['coconut_milk', 80], ['palm_sugar', 30], ['pandan', 5]),
    price: 45_000,
    station: 'cold',
  },
  {
    id: 'dps_bebek_betutu',
    branchId: 'dps',
    categoryId: 'grill',
    name: L('Bebek betutu', '峇里島香料燻鴨', '巴厘岛香料熏鸭', 'Bebek betutu', 'Itik betutu', 'ベベッ・ブトゥトゥ（バリ風燻し鴨）', '베벡 브투투 (발리식 훈연 오리)'),
    description: L(
      'Duck in base genep, wrapped in betel and banana leaves and smoked for hours.',
      '以峇里島香料醬醃漬的鴨，包檳榔葉與蕉葉燻上數小時。',
      '用巴厘岛香料酱腌制的鸭，包槟榔叶和蕉叶熏上数小时。',
      'Bebek berbumbu base genep, dibungkus daun pinang dan pisang, diasap berjam-jam.',
      'Itik berempah base genep, dibalut daun pinang dan pisang, disalai berjam-jam.',
      'バセ・ゲネップをまとわせた鴨をビンロウとバナナの葉で包み、数時間燻しました。',
      '바세 게넵으로 양념한 오리를 빈랑잎과 바나나잎에 싸서 몇 시간 훈연했습니다.',
    ),
    allergenIds: [],
    dietary: diet(),
    spice: { adjustable: true, default: 2 },
    modifierGroupIds: ['spice', 'addons'],
    recipe: r(['duck_leg', 1], ['spice_paste', 60]),
    price: 195_000,
    station: 'grill',
  },
  {
    id: 'dps_lawar',
    branchId: 'dps',
    categoryId: 'veg',
    name: L('Lawar kacang', '峇里島椰香豆角沙拉', '巴厘岛椰香豆角沙拉', 'Lawar kacang', 'Lawar kacang', 'ラワール・カチャン（バリ風いんげんのココナッツ和え）', '라와르 까짱 (발리식 콩줄기 무침)'),
    description: L(
      'Balinese long beans and greens with toasted coconut and spice paste.',
      '峇里島豆角與青菜，拌烤椰絲與香料醬。',
      '巴厘岛豆角与青菜，拌烤椰丝和香料酱。',
      'Kacang panjang dan sayuran khas Bali dengan kelapa sangrai dan bumbu.',
      'Kacang panjang dan sayur gaya Bali dengan kelapa sangai dan rempah.',
      'いんげんと青菜を炒りココナッツとスパイスで和えたバリの一皿。',
      '볶은 코코넛과 양념으로 무친 발리식 긴 콩과 채소.',
    ),
    allergenIds: [],
    dietary: diet({ vegetarian: true, vegan: true }),
    spice: { adjustable: true, default: 1 },
    modifierGroupIds: ['spice'],
    recipe: r(['water_spinach', 120], ['coconut_milk', 40], ['spice_paste', 20], ['chili', 5]),
    price: 65_000,
    station: 'cold',
  },
  {
    id: 'dps_sunset_punch',
    branchId: 'dps',
    categoryId: 'cocktails',
    name: L('Sunset arak punch', '夕陽亞力酒潘趣', '夕阳亚力酒潘趣', 'Punch arak senja', 'Punch arak senja', 'サンセット・アラックパンチ', '선셋 아락 펀치'),
    description: L(
      'Arak, jamu, lime and palm sugar for watching the sun go down.',
      '亞力酒、佳木、萊姆與椰糖，配夕陽最對味。',
      '亚力酒、佳木、青柠和椰糖，配夕阳最对味。',
      'Arak, jamu, jeruk nipis, dan gula aren untuk menikmati matahari terbenam.',
      'Arak, jamu, limau dan gula melaka untuk menikmati matahari terbenam.',
      '夕日を眺めながら。アラック、ジャムウ、ライム、パームシュガー。',
      '해 질 녘을 위한 아락, 자무, 라임, 야자당.',
    ),
    allergenIds: [],
    dietary: diet({ vegetarian: true, vegan: true, containsAlcohol: true }),
    spice: null,
    modifierGroupIds: [],
    recipe: r(['arak', 50], ['jamu_base', 40], ['lime', 15], ['palm_sugar', 10]),
    price: 155_000,
    station: 'bar',
  },
  {
    id: 'kul_nasi_lemak',
    branchId: 'kul',
    categoryId: 'rice',
    name: L('Nasi lemak Bara', 'Bara 椰漿飯', 'Bara 椰浆饭', 'Nasi lemak Bara', 'Nasi lemak Bara', 'ナシレマ・バラ', '나시르막 바라'),
    description: L(
      'Smoked coconut rice with grilled chicken, sambal, egg and peanuts.',
      '煙燻椰漿飯配烤雞、參巴、雞蛋與花生。',
      '烟熏椰浆饭配烤鸡、参巴、鸡蛋和花生。',
      'Nasi santan asap dengan ayam bakar, sambal, telur, dan kacang.',
      'Nasi lemak salai dengan ayam bakar, sambal, telur dan kacang.',
      '燻製ココナッツライスに焼き鳥、サンバル、卵、ピーナッツ。',
      '훈연 코코넛 밥에 구운 닭, 삼발, 달걀, 땅콩.',
    ),
    allergenIds: ['egg', 'peanut', 'crustacean'],
    dietary: diet(),
    spice: { adjustable: true, default: 2 },
    modifierGroupIds: ['spice'],
    recipe: r(['jasmine_rice', 150], ['coconut_milk', 60], ['chicken_thigh', 150], ['egg', 1], ['peanut', 20], ['chili', 10], ['shrimp_paste', 5]),
    price: 2_890,
    station: 'hot',
  },
  {
    id: 'kul_sate_kajang',
    branchId: 'kul',
    categoryId: 'sate',
    name: L('Sate Kajang daging', '加影牛肉沙嗲', '加影牛肉沙爹', 'Sate Kajang daging', 'Sate Kajang daging', 'サテ・カジャン（カジャン風牛串）', '사테 까장 (까장식 소고기 꼬치)'),
    description: L(
      'Kajang-style beef satay with thick peanut gravy and cucumber.',
      '加影風味牛肉沙嗲，配濃郁花生醬與小黃瓜。',
      '加影风味牛肉沙爹，配浓郁花生酱和黄瓜。',
      'Sate daging ala Kajang dengan kuah kacang kental dan mentimun.',
      'Sate daging gaya Kajang dengan kuah kacang pekat dan timun.',
      'カジャン風牛肉サテ、濃厚なピーナッツソースときゅうり。',
      '진한 땅콩 소스와 오이를 곁들인 까장식 소고기 사테.',
    ),
    allergenIds: ['peanut', 'soy'],
    dietary: diet(),
    spice: { adjustable: true, default: 1 },
    modifierGroupIds: ['portion', 'spice'],
    recipe: r(['beef_chuck', 160], ['peanut', 40], ['kecap_manis', 10], ['shallot', 10]),
    price: 2_990,
    station: 'grill',
  },
  {
    id: 'kul_teh_tarik',
    branchId: 'kul',
    categoryId: 'zero',
    name: L('Smoked coconut teh tarik', '煙燻椰香拉茶', '烟熏椰香拉茶', 'Teh tarik kelapa asap', 'Teh tarik kelapa salai', 'スモーク・ココナッツ・テタリ', '훈연 코코넛 테타릭'),
    description: L(
      'Pulled tea with coconut milk and palm sugar, smoked at the counter.',
      '以椰奶與椰糖調製的拉茶，吧檯現場煙燻。',
      '用椰奶和椰糖调制的拉茶，吧台现场烟熏。',
      'Teh tarik dengan santan dan gula aren, diasap di meja bar.',
      'Teh tarik dengan santan dan gula melaka, disalai di kaunter.',
      'ココナッツミルクとパームシュガーのテタリをカウンターで燻して。',
      '코코넛 밀크와 야자당으로 만든 테타릭을 카운터에서 훈연합니다.',
    ),
    allergenIds: [],
    dietary: diet({ vegetarian: true, vegan: true }),
    spice: null,
    modifierGroupIds: ['sweetness'],
    recipe: r(['tea', 8], ['palm_sugar', 15], ['coconut_milk', 80]),
    price: 890,
    station: 'drinks',
  },
  {
    id: 'sin_ikan_pari',
    branchId: 'sin',
    categoryId: 'seafood',
    name: L('BBQ stingray, sambal', '參巴燒魟魚', '参巴烧魔鬼鱼', 'Ikan pari bakar sambal', 'Ikan pari bakar sambal', 'エイのサンバル焼き', '삼발 가오리구이'),
    description: L(
      'Hawker-style stingray grilled on banana leaf with sambal and calamansi.',
      '小販中心風味，蕉葉上燒烤魟魚，配參巴與酸柑。',
      '小贩中心风味，蕉叶上烧烤魔鬼鱼，配参巴和酸柑。',
      'Ikan pari ala hawker dibakar di atas daun pisang dengan sambal dan jeruk kalamansi.',
      'Ikan pari gaya hawker dibakar atas daun pisang dengan sambal dan limau kasturi.',
      'ホーカー風、バナナの葉で焼いたエイにサンバルとカラマンシー。',
      '바나나잎 위에 구운 호커식 가오리, 삼발과 깔라만시.',
    ),
    allergenIds: ['fish', 'crustacean'],
    dietary: diet(),
    spice: { adjustable: true, default: 2 },
    modifierGroupIds: ['spice'],
    recipe: r(['snapper', 350], ['shrimp_paste', 10], ['chili', 15], ['lime', 10]),
    price: 3_200,
    station: 'grill',
  },
  {
    id: 'sin_affogato',
    branchId: 'sin',
    categoryId: 'dessert',
    name: L('Gula Melaka affogato', '椰糖阿芙佳朵', '椰糖阿芙佳朵', 'Affogato gula melaka', 'Affogato gula melaka', 'グラメラカ・アフォガート', '굴라 믈라카 아포가토'),
    description: L(
      'Coconut ice cream drowned in espresso and Gula Melaka.',
      '椰子冰淇淋淋上濃縮咖啡與椰糖。',
      '椰子冰淇淋淋上浓缩咖啡和椰糖。',
      'Es krim kelapa disiram espreso dan gula melaka.',
      'Aiskrim kelapa disiram espreso dan gula melaka.',
      'ココナッツアイスにエスプレッソとグラメラカをたっぷり。',
      '코코넛 아이스크림에 에스프레소와 굴라 믈라카.',
    ),
    allergenIds: [],
    dietary: diet({ vegetarian: true, vegan: true }),
    spice: null,
    modifierGroupIds: [],
    recipe: r(['coffee', 18], ['palm_sugar', 20], ['coconut_milk', 100]),
    price: 1_200,
    station: 'cold',
  },
  {
    id: 'sin_pandan_gimlet',
    branchId: 'sin',
    categoryId: 'cocktails',
    name: L('Pandan gimlet', '香蘭琴蕾', '香兰金蕾', 'Pandan gimlet', 'Pandan gimlet', 'パンダン・ギムレット', '판단 김렛'),
    description: L(
      'Gin, pandan cordial and lime, cold and bright.',
      '琴酒、香蘭糖漿與萊姆，冰涼清爽。',
      '金酒、香兰糖浆和青柠，冰凉清爽。',
      'Gin, sirup pandan, dan jeruk nipis, dingin dan segar.',
      'Gin, kordial pandan dan limau, sejuk dan segar.',
      'ジン、パンダンコーディアル、ライム。冷たく爽やかに。',
      '진, 판단 코디얼, 라임. 차갑고 산뜻하게.',
    ),
    allergenIds: [],
    dietary: diet({ vegetarian: true, vegan: true, containsAlcohol: true }),
    spice: null,
    modifierGroupIds: [],
    recipe: r(['gin', 50], ['pandan', 5], ['lime', 20], ['palm_sugar', 10]),
    price: 2_400,
    station: 'bar',
  },
]

/** A branch's own fish replaces the master recipe's snapper where it's sourced locally. */
export const recipeOverrides: Record<string, Record<string, { lines: RecipeLine[]; note: string }>> = {
  dps: {
    ikan_jimbaran: {
      lines: r(['snapper', 650], ['spice_paste', 55], ['kecap_manis', 20], ['lime', 20]),
      note: 'Larger whole snapper straight from the Jimbaran fish market.',
    },
  },
  sin: {
    iga_bakar: {
      lines: r(['beef_short_rib', 400], ['kecap_manis', 35], ['spice_paste', 30], ['shallot', 20]),
      note: 'Smaller cut for the lunch crowd.',
    },
  },
}
