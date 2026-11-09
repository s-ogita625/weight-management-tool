import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/nav/BottomNav';
import PwaClient from '@/components/pwa/PwaClient';
import { getSessionUserId } from '@/lib/auth';

export const metadata: Metadata = {
  title: '体重管理ツール | 食事・筋トレ計画',
  description:
    '体重・体脂肪率・食事・筋トレ記録から、科学的根拠に基づいたボディメイク計画を支援します。',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // ピンチズームを許可（アクセシビリティ要件）
  themeColor: '#070a0f',
  // 折りたたみ端末のパンチホール・ナビゲーションバー領域まで使う
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userId = await getSessionUserId();

  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col sport-grid-line">
        <main className="page-main mx-auto w-full max-w-6xl flex-1 px-4 pt-4 md:px-6 md:pt-6">
          {children}
        </main>
        {userId ? <BottomNav /> : null}
        {userId ? <PwaClient /> : null}
      </body>
    </html>
  );
}
