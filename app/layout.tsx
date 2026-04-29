import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/nav/BottomNav';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: '体重管理ツール | 食事プラン計画',
  description:
    '体重・体脂肪率・目標から、科学的根拠に基づいた食事プラン（カロリー・PFC）を算出します。',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2563eb',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 pt-4 md:pt-8">
          {children}
        </main>
        {user ? <BottomNav /> : null}
      </body>
    </html>
  );
}
