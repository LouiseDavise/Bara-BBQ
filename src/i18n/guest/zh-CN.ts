import type { GuestMessages } from '../types.js'

const zhCN: GuestMessages = {
  meta: {
    siteName: 'Bara 炭焰',
    tagline: '炭火、烟熏、南洋风味',
    description: '来自印尼群岛的炭火与柴火烧烤。五家 Bara：台北、雅加达、巴厘岛、吉隆坡和新加坡。',
  },
  nav: {
    home: '首页',
    story: '品牌故事',
    locations: '门店',
    menu: '菜单',
    reserve: '订座',
    takeaway: '外带',
    privateDining: '包间与活动',
    gallery: '图库',
    faq: '常见问题',
  },
  actions: {
    reserveTable: '立即订座',
    findBara: '寻找 Bara',
    viewMenu: '查看菜单',
    orderTakeaway: '在线外带',
    close: '关闭',
    back: '返回',
  },
  hours: {
    openNow: '营业中',
    closed: '休息中',
    opensAt: '{time} 开始营业',
    opensOn: '{day} {time} 开始营业',
    closesAt: '营业至 {time}',
    localTime: '当地时间 {time}',
  },
  branch: {
    choose: '选择门店',
    current: 'Bara {city}',
    suggest: '你好像在{country}，要看看 Bara {city} 吗？',
    suggestYes: '好的',
    suggestNo: '暂时不用',
  },
  language: {
    label: '语言',
    choose: '选择语言',
  },
  demo: {
    ribbon: '这是 STOEDIO 的示范餐厅',
    dismiss: '关闭',
  },
  footer: {
    credit: '网站与系统由 STOEDIO 打造',
    branches: '我们的餐厅',
    privacy: '隐私政策',
    rights: '© {year} Bara 炭焰',
  },
  home: {
    comingTitle: '炭火正在点燃。',
    comingBody: 'Bara 的新网站即将上线：台北、雅加达、巴厘岛、吉隆坡和新加坡，尽在一处。',
    staffLink: '员工登录',
  },
  errors: {
    notFound: '找不到这个页面。',
    generic: '出了点问题，请再试一次。',
    backHome: '返回首页',
  },
}

export default zhCN
