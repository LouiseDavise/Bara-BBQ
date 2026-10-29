// Brand-level content. Phase 2 builds the website from this (plus photography).
import { L } from './text.js'

export const brand = {
  name: 'Bara 炭焰',
  founded: 2021,
  tagline: L(
    'Fire, smoke and the flavours of the archipelago',
    '炭火、煙燻、南洋風味',
    '炭火、烟熏、南洋风味',
    'Api, asap, dan rasa Nusantara',
    'Api, asap dan rasa Nusantara',
    '炭火と煙、群島の味わい',
    '숯불과 연기, 군도의 맛',
  ),
  story: L(
    'Chef Raka Pratama grew up between his grandmother’s charcoal stove in Yogyakarta and the night markets of Jakarta. He opened the first Bara in Taipei in 2021, then took the fire home to Jakarta and Bali and across to Kuala Lumpur and Singapore.',
    '主廚 Raka Pratama 從小在日惹外婆的炭爐邊和雅加達的夜市之間長大。2021 年，他在台北開了第一間 Bara，之後把這把火帶回雅加達與峇里島，也帶到吉隆坡和新加坡。',
    '主厨 Raka Pratama 从小在日惹外婆的炭炉边和雅加达的夜市之间长大。2021 年，他在台北开了第一家 Bara，之后把这把火带回雅加达和巴厘岛，也带到吉隆坡和新加坡。',
    'Chef Raka Pratama tumbuh di antara tungku arang neneknya di Yogyakarta dan pasar malam Jakarta. Ia membuka Bara pertama di Taipei pada 2021, lalu membawa apinya pulang ke Jakarta dan Bali, hingga ke Kuala Lumpur dan Singapura.',
    'Chef Raka Pratama membesar di antara dapur arang neneknya di Yogyakarta dan pasar malam Jakarta. Beliau membuka Bara pertama di Taipei pada 2021, kemudian membawa apinya pulang ke Jakarta dan Bali, serta ke Kuala Lumpur dan Singapura.',
    'シェフのラカ・プラタマは、ジョグジャカルタの祖母の炭火コンロとジャカルタのナイトマーケットのあいだで育ちました。2021年に台北で最初の Bara を開き、その火を故郷ジャカルタとバリへ、そしてクアラルンプールとシンガポールへと運びました。',
    '셰프 라카 프라타마는 족자카르타 할머니의 숯불 화로와 자카르타 야시장 사이에서 자랐습니다. 2021년 타이베이에 첫 Bara를 열었고, 그 불을 고향 자카르타와 발리로, 그리고 쿠알라룸푸르와 싱가포르로 가져갔습니다.',
  ),
  chef: { name: 'Raka Pratama', title: L('Founder & chef', '創辦人暨主廚', '创始人兼主厨', 'Pendiri & chef', 'Pengasas & chef', '創業者・シェフ', '창업자 겸 셰프') },
  socials: { instagram: 'bara.grill' },
  press: [],
  origin: 'seed',
}
