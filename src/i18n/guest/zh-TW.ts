import type { GuestMessages } from '../types.js'

const zhTW: GuestMessages = {
  meta: {
    siteName: 'Bara 炭焰',
    tagline: '炭火、煙燻、南洋風味',
    description: '來自印尼群島的炭火與柴火燒烤。五間 Bara：台北、雅加達、峇里島、吉隆坡與新加坡。',
  },
  nav: {
    home: '首頁',
    story: '品牌故事',
    locations: '門市據點',
    menu: '菜單',
    reserve: '訂位',
    takeaway: '外帶',
    privateDining: '包廂與活動',
    gallery: '相簿',
    faq: '常見問題',
  },
  actions: {
    reserveTable: '立即訂位',
    findBara: '尋找 Bara',
    viewMenu: '看菜單',
    orderTakeaway: '線上外帶',
    close: '關閉',
    back: '返回',
  },
  hours: {
    openNow: '營業中',
    closed: '休息中',
    opensAt: '{time} 開始營業',
    opensOn: '{day} {time} 開始營業',
    closesAt: '營業至 {time}',
    localTime: '當地時間 {time}',
  },
  branch: {
    choose: '選擇門市',
    current: 'Bara {city}',
    suggest: '你似乎在{country}，要看 Bara {city} 嗎？',
    suggestYes: '好，帶我去',
    suggestNo: '先不用',
  },
  language: {
    label: '語言',
    choose: '選擇語言',
  },
  demo: {
    ribbon: '這是 STOEDIO 的示範餐廳',
    dismiss: '關閉',
  },
  footer: {
    credit: '網站與系統由 STOEDIO 打造',
    branches: '我們的餐廳',
    privacy: '隱私權政策',
    rights: '© {year} Bara 炭焰',
  },
  home: {
    comingTitle: '炭火正在點燃。',
    comingBody: 'Bara 的新網站即將上線：台北、雅加達、峇里島、吉隆坡與新加坡，一次看遍。',
    staffLink: '員工登入',
  },
  errors: {
    notFound: '找不到這個頁面。',
    generic: '發生錯誤，請再試一次。',
    backHome: '回到首頁',
  },
}

export default zhTW
