// Master catalogue: categories, allergens, modifier groups, kitchen stations and ingredients.
import type { LocalizedText } from '../../../shared/localized.js'
import type { AllergenDoc, IngredientDoc, MasterCategoryDoc, ModifierGroupDoc } from '../../../shared/types/menu.js'
import { L } from './text.js'

export const categories: MasterCategoryDoc[] = [
  {
    id: 'sate',
    kind: 'food',
    sort: 1,
    name: L('Sate & small plates', '沙嗲與小點', '沙爹与小食', 'Sate & hidangan kecil', 'Sate & hidangan kecil', 'サテ＆スモールプレート', '사테 & 스몰 플레이트'),
    description: L(
      'Skewers over charcoal and bites to share.',
      '炭火串燒與分享小點。',
      '炭火串烧与分享小食。',
      'Tusukan bakar arang dan camilan untuk berbagi.',
      'Cucuk bakar arang dan hidangan untuk dikongsi.',
      '炭火の串焼きとシェアして楽しむ小皿。',
      '숯불 꼬치와 함께 나누는 작은 요리.',
    ),
  },
  {
    id: 'grill',
    kind: 'food',
    sort: 2,
    name: L('From the charcoal grill', '炭火燒烤', '炭火烧烤', 'Dari panggangan arang', 'Dari pemanggang arang', '炭火グリル', '숯불 그릴'),
    description: L(
      'Meat and poultry cooked slowly over coconut-husk charcoal.',
      '以椰殼炭慢火燒烤的肉類與家禽。',
      '用椰壳炭慢火烧烤的肉类与禽类。',
      'Daging dan unggas dipanggang perlahan di atas arang batok kelapa.',
      'Daging dan ayam itik dipanggang perlahan di atas arang tempurung kelapa.',
      'ココナッツ殻の炭でじっくり焼く肉料理。',
      '코코넛 껍질 숯으로 천천히 구운 고기 요리.',
    ),
  },
  {
    id: 'seafood',
    kind: 'food',
    sort: 3,
    name: L('Seafood from the fire', '炭烤海鮮', '炭烤海鲜', 'Hidangan laut bakar', 'Makanan laut bakar', '炭火焼きシーフード', '숯불 해산물'),
    description: L(
      'Fish and shellfish, Jimbaran style.',
      '金巴蘭風味的魚與海鮮。',
      '金巴兰风味的鱼与海鲜。',
      'Ikan dan hidangan laut ala Jimbaran.',
      'Ikan dan makanan laut gaya Jimbaran.',
      'ジンバラン流の魚介料理。',
      '짐바란 스타일의 생선과 해산물.',
    ),
  },
  {
    id: 'veg',
    kind: 'food',
    sort: 4,
    name: L('Vegetables & sides', '蔬菜與配菜', '蔬菜与配菜', 'Sayuran & pelengkap', 'Sayur-sayuran & sampingan', '野菜とサイド', '채소 & 사이드'),
    description: L(
      'Charred vegetables with house sambals.',
      '炭烤蔬菜佐自製參巴醬。',
      '炭烤蔬菜配自制参巴酱。',
      'Sayuran bakar dengan sambal buatan sendiri.',
      'Sayur bakar dengan sambal buatan sendiri.',
      '焦がし野菜と自家製サンバル。',
      '숯불에 구운 채소와 수제 삼발.',
    ),
  },
  {
    id: 'rice',
    kind: 'food',
    sort: 5,
    name: L('Rice & noodles', '飯與麵', '饭与面', 'Nasi & mi', 'Nasi & mi', 'ご飯と麺', '밥 & 면'),
    description: L(
      'Smoked rice and wok-fired noodles.',
      '煙燻米飯與鍋氣炒麵。',
      '烟熏米饭与镬气炒面。',
      'Nasi asap dan mi tumis.',
      'Nasi salai dan mi goreng.',
      '燻製ご飯と中華鍋で炒めた麺。',
      '훈연 밥과 웍에 볶은 면.',
    ),
  },
  {
    id: 'dessert',
    kind: 'dessert',
    sort: 6,
    name: L('Desserts', '甜點', '甜品', 'Hidangan penutup', 'Pencuci mulut', 'デザート', '디저트'),
    description: L(
      'Palm sugar, pandan and coconut.',
      '椰糖、香蘭與椰子。',
      '椰糖、香兰与椰子。',
      'Gula aren, pandan, dan kelapa.',
      'Gula melaka, pandan dan kelapa.',
      'パームシュガー、パンダン、ココナッツ。',
      '야자당, 판단, 코코넛.',
    ),
  },
  {
    id: 'cocktails',
    kind: 'drinks',
    sort: 7,
    name: L('Cocktails & beer', '調酒與啤酒', '鸡尾酒与啤酒', 'Koktail & bir', 'Koktel & bir', 'カクテル＆ビール', '칵테일 & 맥주'),
    description: L(
      'Indonesian-inspired cocktails and local craft beer.',
      '印尼風味調酒與在地精釀啤酒。',
      '印尼风味鸡尾酒与本地精酿啤酒。',
      'Koktail bernuansa Indonesia dan bir kerajinan lokal.',
      'Koktel ala Indonesia dan bir kraf tempatan.',
      'インドネシアに着想を得たカクテルと地元のクラフトビール。',
      '인도네시아에서 영감을 받은 칵테일과 지역 수제 맥주.',
    ),
  },
  {
    id: 'zero',
    kind: 'drinks',
    sort: 8,
    name: L('Zero-proof, coffee & tea', '無酒精飲品、咖啡與茶', '无酒精饮品、咖啡与茶', 'Tanpa alkohol, kopi & teh', 'Tanpa alkohol, kopi & teh', 'ノンアルコール、コーヒー＆ティー', '논알코올, 커피 & 차'),
    description: L(
      'Mocktails, jamu, palm sugar coffee and tea.',
      '無酒精調飲、佳木草本飲、椰糖咖啡與茶。',
      '无酒精特调、佳木草本饮、椰糖咖啡与茶。',
      'Mocktail, jamu, kopi gula aren, dan teh.',
      'Mocktail, jamu, kopi gula melaka dan teh.',
      'モクテル、ジャムウ、パームシュガーコーヒー、紅茶。',
      '목테일, 자무, 야자당 커피와 차.',
    ),
  },
]

const allergen = (id: string, sort: number, name: LocalizedText): AllergenDoc => ({ id, sort, icon: id, name })

export const allergens: AllergenDoc[] = [
  allergen('peanut', 1, L('Peanuts', '花生', '花生', 'Kacang tanah', 'Kacang tanah', '落花生', '땅콩')),
  allergen('treeNut', 2, L('Tree nuts', '堅果', '坚果', 'Kacang pohon', 'Kekacang pokok', '木の実', '견과류')),
  allergen('crustacean', 3, L('Crustaceans', '甲殼類', '甲壳类', 'Krustasea', 'Krustasea', '甲殻類', '갑각류')),
  allergen('mollusc', 4, L('Molluscs', '軟體動物', '软体动物', 'Moluska', 'Moluska', '軟体動物', '연체류')),
  allergen('fish', 5, L('Fish', '魚類', '鱼类', 'Ikan', 'Ikan', '魚', '생선')),
  allergen('egg', 6, L('Egg', '蛋', '蛋', 'Telur', 'Telur', '卵', '달걀')),
  allergen('milk', 7, L('Milk', '乳製品', '乳制品', 'Susu', 'Susu', '乳', '우유')),
  allergen('soy', 8, L('Soy', '大豆', '大豆', 'Kedelai', 'Soya', '大豆', '대두')),
  allergen('gluten', 9, L('Gluten', '麩質', '麸质', 'Gluten', 'Gluten', '小麦（グルテン）', '글루텐')),
  allergen('sesame', 10, L('Sesame', '芝麻', '芝麻', 'Wijen', 'Bijan', 'ごま', '참깨')),
  allergen('sulphite', 11, L('Sulphites', '亞硫酸鹽', '亚硫酸盐', 'Sulfit', 'Sulfit', '亜硫酸塩', '아황산염')),
]

/** Kitchen stations. KL has no bar (no alcohol), so its drinks station is called Drinks. */
export const stationNames = {
  grill: L('Grill', '炭烤', '炭烤', 'Panggang', 'Panggang', 'グリル', '그릴'),
  hot: L('Hot kitchen', '熱廚', '热厨', 'Dapur panas', 'Dapur panas', 'ホットキッチン', '핫 키친'),
  cold: L('Cold & pastry', '冷盤甜點', '冷菜甜品', 'Dingin & pastri', 'Sejuk & pastri', 'コールド＆パティスリー', '콜드 & 페이스트리'),
  bar: L('Bar', '吧台', '吧台', 'Bar', 'Bar', 'バー', '바'),
  drinks: L('Drinks', '飲品', '饮品', 'Minuman', 'Minuman', 'ドリンク', '음료'),
}

export const modifierGroups: ModifierGroupDoc[] = [
  {
    id: 'spice',
    kind: 'spice',
    name: L('Spice level', '辣度', '辣度', 'Tingkat pedas', 'Tahap pedas', '辛さ', '맵기'),
    required: true,
    min: 1,
    max: 1,
    options: [
      { id: 's0', name: L('Not spicy', '不辣', '不辣', 'Tidak pedas', 'Tidak pedas', '辛さなし', '안 맵게'), priceDelta: {} },
      { id: 's1', name: L('Mild', '小辣', '微辣', 'Sedikit pedas', 'Sedikit pedas', '控えめ', '약간 맵게'), priceDelta: {} },
      { id: 's2', name: L('Hot', '中辣', '中辣', 'Pedas', 'Pedas', '辛口', '맵게'), priceDelta: {} },
      { id: 's3', name: L('Bara hot', 'Bara 大辣', 'Bara 特辣', 'Pedas Bara', 'Pedas Bara', 'Bara激辛', 'Bara 아주 맵게'), priceDelta: {} },
    ],
  },
  {
    id: 'doneness',
    kind: 'doneness',
    name: L('Doneness', '熟度', '熟度', 'Tingkat kematangan', 'Tahap kematangan', '焼き加減', '굽기'),
    required: true,
    min: 1,
    max: 1,
    options: [
      { id: 'mr', name: L('Medium rare', '三分熟', '三分熟', 'Medium rare', 'Medium rare', 'ミディアムレア', '미디엄 레어'), priceDelta: {} },
      { id: 'm', name: L('Medium', '五分熟', '五分熟', 'Medium', 'Medium', 'ミディアム', '미디엄'), priceDelta: {} },
      { id: 'mw', name: L('Medium well', '七分熟', '七分熟', 'Medium well', 'Medium well', 'ミディアムウェル', '미디엄 웰'), priceDelta: {} },
      { id: 'wd', name: L('Well done', '全熟', '全熟', 'Matang', 'Masak penuh', 'ウェルダン', '웰던'), priceDelta: {} },
    ],
  },
  {
    id: 'sambal',
    kind: 'sauce',
    name: L('Sambal', '參巴醬', '参巴酱', 'Sambal', 'Sambal', 'サンバル', '삼발'),
    required: true,
    min: 1,
    max: 2,
    options: [
      {
        id: 'matah',
        name: L('Sambal matah (shallot & lemongrass)', '生參巴（紅蔥香茅）', '生参巴（红葱香茅）', 'Sambal matah', 'Sambal matah', 'サンバル・マタ（エシャロットとレモングラス）', '삼발 마타 (샬롯·레몬그라스)'),
        priceDelta: {},
        recipe: [{ ingredientId: 'shallot', qty: 15 }, { ingredientId: 'lemongrass', qty: 5 }],
      },
      {
        id: 'ijo',
        name: L('Sambal ijo (green chilli)', '青辣椒參巴', '青辣椒参巴', 'Sambal ijo', 'Sambal hijau', 'サンバル・イジョ（青唐辛子）', '삼발 이조 (풋고추)'),
        priceDelta: {},
        recipe: [{ ingredientId: 'chili', qty: 10 }],
      },
      {
        id: 'bawang',
        name: L('Sambal bawang (fried shallot)', '紅蔥參巴', '红葱参巴', 'Sambal bawang', 'Sambal bawang', 'サンバル・バワン（揚げエシャロット）', '삼발 바왕 (튀긴 샬롯)'),
        priceDelta: {},
        recipe: [{ ingredientId: 'shallot', qty: 15 }, { ingredientId: 'chili', qty: 5 }],
      },
      {
        id: 'terasi',
        name: L('Sambal terasi (shrimp paste)', '蝦醬參巴', '虾酱参巴', 'Sambal terasi', 'Sambal belacan', 'サンバル・トラシ（エビペースト）', '삼발 트라시 (새우 페이스트)'),
        priceDelta: {},
        recipe: [{ ingredientId: 'shrimp_paste', qty: 5 }, { ingredientId: 'chili', qty: 8 }],
        allergenIds: ['crustacean'],
      },
      {
        id: 'kacang',
        name: L('Peanut sauce', '花生醬', '花生酱', 'Bumbu kacang', 'Kuah kacang', 'ピーナッツソース', '땅콩 소스'),
        priceDelta: {},
        recipe: [{ ingredientId: 'peanut', qty: 30 }],
        allergenIds: ['peanut'],
      },
    ],
  },
  {
    id: 'addons',
    kind: 'addon',
    name: L('Add-ons', '加點', '加点', 'Tambahan', 'Tambahan', '追加', '추가'),
    required: false,
    min: 0,
    max: 4,
    options: [
      {
        id: 'rice',
        name: L('Steamed rice', '白飯', '白米饭', 'Nasi putih', 'Nasi putih', '白ご飯', '공깃밥'),
        priceDelta: { TWD: 30, IDR: 10_000, MYR: 300, SGD: 200 },
        recipe: [{ ingredientId: 'jasmine_rice', qty: 130 }],
      },
      {
        id: 'egg',
        name: L('Fried egg', '荷包蛋', '荷包蛋', 'Telur ceplok', 'Telur mata', '目玉焼き', '계란 프라이'),
        priceDelta: { TWD: 30, IDR: 8_000, MYR: 250, SGD: 150 },
        recipe: [{ ingredientId: 'egg', qty: 1 }],
        allergenIds: ['egg'],
      },
      {
        id: 'kerupuk',
        name: L('Prawn crackers', '蝦餅', '虾片', 'Kerupuk udang', 'Keropok udang', 'えびせんべい', '새우칩'),
        priceDelta: { TWD: 40, IDR: 10_000, MYR: 300, SGD: 200 },
        recipe: [{ ingredientId: 'prawn', qty: 10 }],
        allergenIds: ['crustacean'],
      },
      {
        id: 'extraSambal',
        name: L('Extra sambal', '多一份參巴', '加一份参巴', 'Sambal tambahan', 'Sambal tambahan', 'サンバル追加', '삼발 추가'),
        priceDelta: { TWD: 20, IDR: 5_000, MYR: 200, SGD: 100 },
        recipe: [{ ingredientId: 'chili', qty: 10 }, { ingredientId: 'shallot', qty: 10 }],
      },
    ],
  },
  {
    id: 'portion',
    kind: 'portion',
    name: L('Portion', '份量', '份量', 'Porsi', 'Saiz hidangan', '本数', '양'),
    required: true,
    min: 1,
    max: 1,
    options: [
      { id: 'six', name: L('6 skewers', '6 串', '6 串', '6 tusuk', '6 cucuk', '6本', '6꼬치'), priceDelta: {} },
      { id: 'ten', name: L('10 skewers', '10 串', '10 串', '10 tusuk', '10 cucuk', '10本', '10꼬치'), priceDelta: { TWD: 180, IDR: 45_000, MYR: 1_400, SGD: 1_000 } },
    ],
  },
  {
    id: 'sweetness',
    kind: 'sweetness',
    name: L('Sweetness', '甜度', '甜度', 'Tingkat manis', 'Tahap manis', '甘さ', '당도'),
    required: true,
    min: 1,
    max: 1,
    options: [
      { id: 'normal', name: L('Normal', '正常', '正常', 'Normal', 'Biasa', '普通', '보통'), priceDelta: {} },
      { id: 'less', name: L('Less sweet', '少糖', '少糖', 'Kurang manis', 'Kurang manis', '甘さ控えめ', '덜 달게'), priceDelta: {} },
    ],
  },
]

type Unit = IngredientDoc['unit']
type Category = IngredientDoc['category']

/**
 * Cost per kg, litre or piece in each currency's minor unit (TWD and IDR whole units, MYR sen,
 * SGD cents). `null` where the branch never stocks it (no alcohol in Kuala Lumpur).
 */
export interface IngredientSeed extends IngredientDoc {
  cost: { TWD: number; IDR: number; MYR: number | null; SGD: number }
}

const ing = (id: string, unit: Unit, category: Category, name: LocalizedText, cost: IngredientSeed['cost'], allergenIds: string[] = []): IngredientSeed => ({
  id,
  unit,
  category,
  name,
  allergenIds,
  cost,
})

export const ingredients: IngredientSeed[] = [
  ing('chicken_thigh', 'g', 'meat', L('Chicken thigh', '雞腿肉', '鸡腿肉', 'Paha ayam', 'Peha ayam', '鶏もも肉', '닭다리살'), { TWD: 220, IDR: 65_000, MYR: 1_600, SGD: 900 }),
  ing('beef_short_rib', 'g', 'meat', L('Beef short rib', '牛小排', '牛小排', 'Iga sapi', 'Iga lembu', '牛ショートリブ', '소갈비'), { TWD: 1_100, IDR: 280_000, MYR: 9_000, SGD: 3_800 }),
  ing('wagyu_sirloin', 'g', 'meat', L('Wagyu sirloin', '和牛沙朗', '和牛西冷', 'Sirloin wagyu', 'Sirloin wagyu', '和牛サーロイン', '와규 등심'), { TWD: 2_600, IDR: 750_000, MYR: 22_000, SGD: 9_000 }),
  ing('lamb_rib', 'g', 'meat', L('Lamb ribs', '羊排', '羊排', 'Iga kambing', 'Rusuk kambing', 'ラムリブ', '양갈비'), { TWD: 900, IDR: 220_000, MYR: 7_000, SGD: 3_200 }),
  ing('duck_leg', 'pcs', 'meat', L('Duck leg', '鴨腿', '鸭腿', 'Paha bebek', 'Peha itik', '鴨もも肉', '오리 다리'), { TWD: 120, IDR: 35_000, MYR: 1_200, SGD: 600 }),
  ing('beef_chuck', 'g', 'meat', L('Beef chuck', '牛肩肉', '牛肩肉', 'Daging sapi has', 'Daging bahu lembu', '牛肩ロース', '소 목심'), { TWD: 600, IDR: 140_000, MYR: 4_500, SGD: 2_200 }),
  ing('snapper', 'g', 'seafood', L('Red snapper', '紅鯛', '红鲷', 'Ikan kakap merah', 'Ikan merah', '鯛', '도미'), { TWD: 500, IDR: 95_000, MYR: 3_500, SGD: 2_400 }, ['fish']),
  ing('prawn', 'g', 'seafood', L('Prawns', '大蝦', '大虾', 'Udang', 'Udang', '海老', '새우'), { TWD: 700, IDR: 150_000, MYR: 5_000, SGD: 3_000 }, ['crustacean']),
  ing('squid', 'g', 'seafood', L('Squid', '小卷', '鱿鱼', 'Cumi-cumi', 'Sotong', 'イカ', '오징어'), { TWD: 400, IDR: 80_000, MYR: 2_800, SGD: 1_800 }, ['mollusc']),
  ing('salmon', 'g', 'seafood', L('Salmon', '鮭魚', '三文鱼', 'Salmon', 'Salmon', 'サーモン', '연어'), { TWD: 1_000, IDR: 320_000, MYR: 9_000, SGD: 4_200 }, ['fish']),
  ing('shallot', 'g', 'produce', L('Shallots', '紅蔥頭', '红葱头', 'Bawang merah', 'Bawang merah', 'エシャロット', '샬롯'), { TWD: 120, IDR: 40_000, MYR: 900, SGD: 600 }),
  ing('garlic', 'g', 'produce', L('Garlic', '大蒜', '大蒜', 'Bawang putih', 'Bawang putih', 'にんにく', '마늘'), { TWD: 150, IDR: 38_000, MYR: 1_000, SGD: 700 }),
  ing('chili', 'g', 'produce', L('Chillies', '辣椒', '辣椒', 'Cabai', 'Cili', '唐辛子', '고추'), { TWD: 200, IDR: 60_000, MYR: 1_500, SGD: 900 }),
  ing('lemongrass', 'g', 'produce', L('Lemongrass', '香茅', '香茅', 'Serai', 'Serai', 'レモングラス', '레몬그라스'), { TWD: 150, IDR: 20_000, MYR: 800, SGD: 600 }),
  ing('lime', 'g', 'produce', L('Lime', '萊姆', '青柠', 'Jeruk nipis', 'Limau nipis', 'ライム', '라임'), { TWD: 120, IDR: 25_000, MYR: 800, SGD: 500 }),
  ing('eggplant', 'g', 'produce', L('Eggplant', '茄子', '茄子', 'Terong', 'Terung', 'ナス', '가지'), { TWD: 80, IDR: 15_000, MYR: 600, SGD: 400 }),
  ing('water_spinach', 'g', 'produce', L('Water spinach', '空心菜', '空心菜', 'Kangkung', 'Kangkung', '空心菜', '공심채'), { TWD: 80, IDR: 12_000, MYR: 500, SGD: 400 }),
  ing('corn', 'pcs', 'produce', L('Sweetcorn', '玉米', '玉米', 'Jagung manis', 'Jagung manis', 'とうもろこし', '옥수수'), { TWD: 25, IDR: 5_000, MYR: 200, SGD: 120 }),
  ing('banana', 'pcs', 'produce', L('Banana', '香蕉', '香蕉', 'Pisang', 'Pisang', 'バナナ', '바나나'), { TWD: 10, IDR: 2_000, MYR: 50, SGD: 40 }),
  ing('pandan', 'g', 'produce', L('Pandan leaves', '香蘭葉', '香兰叶', 'Daun pandan', 'Daun pandan', 'パンダンリーフ', '판단잎'), { TWD: 300, IDR: 30_000, MYR: 1_000, SGD: 800 }),
  ing('coconut_young', 'pcs', 'produce', L('Young coconut', '嫩椰子', '嫩椰子', 'Kelapa muda', 'Kelapa muda', 'ヤングココナッツ', '어린 코코넛'), { TWD: 60, IDR: 12_000, MYR: 500, SGD: 300 }),
  ing('jasmine_rice', 'g', 'dry', L('Jasmine rice', '茉莉香米', '茉莉香米', 'Beras melati', 'Beras wangi', 'ジャスミンライス', '재스민 쌀'), { TWD: 60, IDR: 15_000, MYR: 500, SGD: 300 }),
  ing('egg', 'pcs', 'dairy', L('Eggs', '雞蛋', '鸡蛋', 'Telur', 'Telur', '卵', '달걀'), { TWD: 7, IDR: 2_000, MYR: 50, SGD: 30 }, ['egg']),
  ing('tofu', 'g', 'dry', L('Tofu', '豆腐', '豆腐', 'Tahu', 'Tauhu', '豆腐', '두부'), { TWD: 80, IDR: 15_000, MYR: 600, SGD: 400 }, ['soy']),
  ing('peanut', 'g', 'dry', L('Peanuts', '花生', '花生', 'Kacang tanah', 'Kacang tanah', 'ピーナッツ', '땅콩'), { TWD: 160, IDR: 35_000, MYR: 1_200, SGD: 700 }, ['peanut']),
  ing('kecap_manis', 'ml', 'dry', L('Kecap manis (sweet soy)', '印尼甜醬油', '印尼甜酱油', 'Kecap manis', 'Kicap manis', 'ケチャップマニス（甘口醤油）', '케찹 마니스 (단간장)'), { TWD: 200, IDR: 45_000, MYR: 1_500, SGD: 900 }, ['soy']),
  ing('coconut_milk', 'ml', 'dry', L('Coconut milk', '椰奶', '椰奶', 'Santan', 'Santan', 'ココナッツミルク', '코코넛 밀크'), { TWD: 120, IDR: 30_000, MYR: 900, SGD: 600 }),
  ing('palm_sugar', 'g', 'dry', L('Palm sugar', '椰糖', '椰糖', 'Gula aren', 'Gula melaka', 'パームシュガー', '야자당'), { TWD: 250, IDR: 40_000, MYR: 1_200, SGD: 900 }),
  ing('shrimp_paste', 'g', 'dry', L('Shrimp paste', '蝦醬', '虾酱', 'Terasi', 'Belacan', 'エビペースト', '새우 페이스트'), { TWD: 400, IDR: 80_000, MYR: 2_500, SGD: 1_600 }, ['crustacean']),
  ing('rice_flour', 'g', 'dry', L('Rice flour', '米穀粉', '米粉', 'Tepung beras', 'Tepung beras', '米粉', '쌀가루'), { TWD: 80, IDR: 18_000, MYR: 600, SGD: 400 }),
  ing('noodles', 'g', 'dry', L('Egg noodles', '雞蛋麵', '鸡蛋面', 'Mi telur', 'Mi telur', '卵麺', '에그 누들'), { TWD: 90, IDR: 20_000, MYR: 700, SGD: 450 }, ['gluten', 'egg']),
  ing('spice_paste', 'g', 'dry', L('House spice paste (base genep)', '自製香料醬', '自制香料酱', 'Bumbu base genep', 'Rempah base genep', '自家製スパイスペースト', '수제 양념 페이스트'), { TWD: 300, IDR: 60_000, MYR: 2_000, SGD: 1_400 }),
  ing('jamu_base', 'ml', 'beverage', L('Jamu base (turmeric & ginger)', '佳木基底（薑黃薑汁）', '佳木基底（姜黄姜汁）', 'Jamu kunyit jahe', 'Jamu kunyit halia', 'ジャムウベース（ターメリック・生姜）', '자무 베이스 (강황·생강)'), { TWD: 200, IDR: 35_000, MYR: 1_200, SGD: 900 }),
  ing('coffee', 'g', 'beverage', L('Coffee beans', '咖啡豆', '咖啡豆', 'Biji kopi', 'Biji kopi', 'コーヒー豆', '원두'), { TWD: 900, IDR: 180_000, MYR: 6_000, SGD: 3_500 }),
  ing('tea', 'g', 'beverage', L('Black tea', '紅茶', '红茶', 'Teh hitam', 'Teh hitam', '紅茶', '홍차'), { TWD: 600, IDR: 120_000, MYR: 4_000, SGD: 2_500 }),
  ing('arak', 'ml', 'alcohol', L('Balinese arak', '峇里島亞力酒', '巴厘岛亚力酒', 'Arak Bali', 'Arak Bali', 'バリのアラック', '발리 아락'), { TWD: 900, IDR: 150_000, MYR: null, SGD: 6_000 }),
  ing('gin', 'ml', 'alcohol', L('Gin', '琴酒', '金酒', 'Gin', 'Gin', 'ジン', '진'), { TWD: 1_200, IDR: 600_000, MYR: null, SGD: 7_000 }),
  ing('sparkling_wine', 'ml', 'alcohol', L('Sparkling wine', '氣泡酒', '起泡酒', 'Anggur bersoda', 'Wain berbuih', 'スパークリングワイン', '스파클링 와인'), { TWD: 600, IDR: 400_000, MYR: null, SGD: 3_500 }, ['sulphite']),
  ing('craft_beer', 'ml', 'alcohol', L('Craft beer (keg)', '精釀生啤', '精酿生啤', 'Bir kerajinan (tong)', 'Bir kraf (tong)', 'クラフトビール（樽）', '수제 맥주 (케그)'), { TWD: 250, IDR: 80_000, MYR: null, SGD: 1_400 }, ['gluten']),
]
