'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logoutAction } from '@/app/actions/auth';

const mainItems = [
  { href: '/', label: 'ホーム', icon: '🏠' },
  { href: '/morning', label: '朝記録', icon: '🌅' },
  { href: '/log', label: '食事', icon: '🍽️' },
  { href: '/budget', label: '家計簿', icon: '💴' },
];

const moreItems = [
  { href: '/plan', label: '食事プラン', icon: '📊' },
  { href: '/trend', label: 'トレンド分析', icon: '📈' },
  { href: '/history', label: '食事履歴', icon: '📅' },
  { href: '/budget/recurring', label: '固定費の管理', icon: '📌' },
  { href: '/coach', label: 'AIコーチング', icon: '💡' },
  { href: '/chat', label: 'AIチャット', icon: '💬' },
  { href: '/onboarding', label: 'プロフィール編集', icon: '⚙️' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // ページ遷移時にメニューを閉じる
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // body スクロール抑止
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [menuOpen]);

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 h-16 bg-white border-t border-gray-200 grid grid-cols-5 z-40 md:relative md:max-w-2xl md:mx-auto md:mt-8 md:rounded-xl md:border md:shadow-sm">
        {mainItems.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center text-[11px] gap-0.5 leading-tight px-1 text-center ${
                active ? 'text-blue-600 font-semibold' : 'text-gray-500'
              }`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center justify-center text-[11px] gap-0.5 leading-tight px-1 text-center text-gray-500"
          aria-label="メニュー"
        >
          <span className="text-xl leading-none">☰</span>
          <span>メニュー</span>
        </button>
      </nav>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => setMenuOpen(false)}
          />
          <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-xl pb-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="text-base font-semibold">メニュー</h3>
              <button
                onClick={() => setMenuOpen(false)}
                className="text-gray-500 text-2xl leading-none px-2"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            <ul className="divide-y divide-gray-100">
              {moreItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              ))}
              <li>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-rose-50 text-rose-600"
                  >
                    <span className="text-2xl">🚪</span>
                    <span className="font-medium">ログアウト</span>
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </>
      )}
    </>
  );
}
