import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { AnalyticsReport } from '@/lib/db'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 42
const INK = rgb(0.09, 0.24, 0.21)
const MUTED = rgb(0.38, 0.46, 0.43)
const LINE = rgb(0.84, 0.88, 0.85)

function fitText(font: PDFFont, value: string, maxWidth: number, size: number) {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value
  const chars = Array.from(value)
  while (chars.length && font.widthOfTextAtSize(`${chars.join('')}…`, size) > maxWidth) chars.pop()
  return `${chars.join('')}…`
}

export async function createAnalyticsPdf(report: AnalyticsReport, selectedCompanyName: string) {
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  const fontBytes = await readFile(join(process.cwd(), 'assets', 'fonts', 'NotoSansJP-Regular.ttf'))
  const font = await document.embedFont(fontBytes, { subset: false })
  let page: PDFPage
  let y = 0
  let pageNumber = 0

  function text(value: string, x: number, atY: number, size = 10, color = INK) {
    page.drawText(value, { x, y: atY, size, font, color })
  }

  function horizontalLine(atY: number, color = LINE) {
    page.drawLine({ start: { x: MARGIN, y: atY }, end: { x: PAGE_WIDTH - MARGIN, y: atY }, thickness: 0.7, color })
  }

  function newPage() {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    pageNumber += 1
    text('rally 資産形成 アクセス分析レポート', MARGIN, PAGE_HEIGHT - 33, 8, MUTED)
    text(String(pageNumber), PAGE_WIDTH - MARGIN - 10, 23, 8, MUTED)
    horizontalLine(PAGE_HEIGHT - 41)
    y = PAGE_HEIGHT - 67
  }

  function ensure(space: number) {
    if (y - space < 45) newPage()
  }

  function heading(value: string) {
    ensure(32)
    text(value, MARGIN, y, 14)
    y -= 25
  }

  newPage()
  text('企業別アクセス分析', MARGIN, y, 23)
  y -= 33
  text(`対象：${fitText(font, selectedCompanyName, PAGE_WIDTH - MARGIN * 2 - 36, 11)}`, MARGIN, y, 11)
  y -= 19
  text(`期間：${report.range.from} ～ ${report.range.to}（日本時間）`, MARGIN, y, 10, MUTED)
  y -= 16
  text(`作成日時：${new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'long', timeStyle: 'medium' }).format(new Date())}`, MARGIN, y, 9, MUTED)
  y -= 34

  const cards = [
    ['ログイン数', report.summary.logins],
    ['アクセス数', report.summary.pageViews],
    ['ユニーク数（概算）', report.summary.uniqueSessions],
  ] as const
  cards.forEach(([label, value], index) => {
    const x = MARGIN + index * 172
    const color = index === 0 ? rgb(0.91, 0.95, 0.92) : index === 1 ? rgb(0.97, 0.93, 0.87) : rgb(0.93, 0.94, 0.96)
    page.drawRectangle({ x, y: y - 51, width: 158, height: 62, color })
    text(label, x + 12, y - 10, 9, MUTED)
    text(value.toLocaleString('ja-JP'), x + 12, y - 39, 20)
  })
  y -= 80
  text(`企業コード入力：${report.summary.codeLogins.toLocaleString('ja-JP')}回　固定リンク：${report.summary.linkLogins.toLocaleString('ja-JP')}回`, MARGIN, y, 9, MUTED)
  y -= 32

  heading('よく見られたページ・リンク（上位10件）')
  const maxViews = Math.max(1, ...report.pages.map((item) => item.pageViews))
  if (!report.pages.length) {
    text('期間内のアクセスデータはありません。', MARGIN, y, 10, MUTED)
    y -= 22
  } else {
    report.pages.slice(0, 10).forEach((item, index) => {
      ensure(31)
      text(`${index + 1}. ${fitText(font, item.label, 145, 9)}`, MARGIN, y, 9)
      text(`${item.pageViews.toLocaleString('ja-JP')} 回`, PAGE_WIDTH - MARGIN - 62, y, 9)
      page.drawRectangle({ x: MARGIN + 225, y: y - 1, width: Math.max(3, Math.round(200 * item.pageViews / maxViews)), height: 8, color: rgb(0.38, 0.63, 0.54) })
      y -= 23
    })
  }
  y -= 13

  if (!report.selectedCompanyId) {
    heading('企業別比較')
    report.companyRows.forEach((row) => {
      ensure(25)
      text(fitText(font, row.companyName, 155, 9), MARGIN, y, 9)
      text(`ログイン ${row.logins.toLocaleString('ja-JP')}　アクセス ${row.pageViews.toLocaleString('ja-JP')}　ユニーク数（概算） ${row.uniqueSessions.toLocaleString('ja-JP')}`, 210, y, 7.5, MUTED)
      y -= 19
      horizontalLine(y + 7, rgb(0.9, 0.92, 0.91))
    })
    y -= 12
  }

  heading('日別推移')
  text('日付', MARGIN, y, 8, MUTED)
  text('ログイン', 225, y, 8, MUTED)
  text('アクセス', 330, y, 8, MUTED)
  text('ユニーク数（概算）', 420, y, 8, MUTED)
  y -= 17
  for (const day of report.daily) {
    ensure(19)
    text(day.date, MARGIN, y, 8)
    text(day.logins.toLocaleString('ja-JP'), 225, y, 8)
    text(day.pageViews.toLocaleString('ja-JP'), 330, y, 8)
    text(day.uniqueSessions.toLocaleString('ja-JP'), 440, y, 8)
    y -= 16
  }
  ensure(42)
  y -= 10
  horizontalLine(y)
  y -= 16
  text('注：ユニーク数（概算）は、同じ端末・ブラウザからの利用を1日1回として数えます。', MARGIN, y, 8, MUTED)
  y -= 13
  text('アクセス数にはページ表示と内容利用クリックを含み、サービス詳細ページ・戻る等は除外します。', MARGIN, y, 8, MUTED)
  y -= 13
  text('会員トップ表示は再読み込み・戻り・認証継続中の再訪でも加算され、ログイン数とは一致しません。', MARGIN, y, 8, MUTED)

  return Buffer.from(await document.save({ useObjectStreams: false }))
}
