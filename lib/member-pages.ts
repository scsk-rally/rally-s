export const memberPagePaths = [
  '/dashboard.html', '/seminar.html', '/expert.html', '/saliva-checker.html',
  '/embed-expert.html', '/embed-fp.html', '/embed-fudosan.html', '/embed-horitsu.html',
  '/embed-iryo.html', '/embed-lifeplan.html', '/embed-dc-simulator.html', '/embed-manehapi.html', '/embed-menu.html',
  '/embed-service.html', '/embed-service.htm', '/embed-toshi.html', '/embed-zeimu.html',
] as const

export const memberPageLabels: Record<(typeof memberPagePaths)[number], string> = {
  '/dashboard.html': '会員トップ',
  '/seminar.html': 'セミナー',
  '/expert.html': '専門家相談',
  '/saliva-checker.html': 'サリバチェッカー',
  '/embed-expert.html': '専門家相談（詳細）',
  '/embed-fp.html': 'FP相談',
  '/embed-fudosan.html': '不動産相談',
  '/embed-horitsu.html': '法律相談',
  '/embed-iryo.html': '医療相談',
  '/embed-lifeplan.html': 'ライフプラン相談',
  '/embed-dc-simulator.html': '確定拠出年金シミュレーション',
  '/embed-manehapi.html': 'マネハピ通信',
  '/embed-menu.html': 'メニュー（詳細）',
  '/embed-service.html': 'サービス（詳細）',
  '/embed-service.htm': 'サービス（詳細・旧URL）',
  '/embed-toshi.html': '投資相談',
  '/embed-zeimu.html': '税務相談',
}

const memberPages = new Set<string>(memberPagePaths)

export const memberLinkEventPaths = ['@link:pension', '@link:stock-plan'] as const
const memberLinkEvents = new Set<string>(memberLinkEventPaths)

export const memberAnalyticsLabels: Record<string, string> = {
  ...memberPageLabels,
  '@link:pension': '確定拠出年金リンク（クリック）',
  '@link:stock-plan': '持株会リンク（クリック）',
}

export function isMemberPagePath(path: string) {
  return memberPages.has(path) || path.startsWith('/dc-simulator/')
}

export function isMemberAnalyticsPath(path: string) {
  return memberPages.has(path) || memberLinkEvents.has(path)
}

export function isStoredAnalyticsPath(path: string) {
  return isMemberAnalyticsPath(path) || /^@click:[a-f0-9]{40}$/.test(path)
}
