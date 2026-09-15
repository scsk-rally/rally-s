import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'rally 資産形成',
  description: 'お金と暮らしのことを、できることから始める資産形成支援プラットフォームです。',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
