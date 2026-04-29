'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';

const items = [
  { href: '/', label: 'ホーム', icon: '🏠' },
  { href: '/plan', label: 'プラン', icon: '📊' },
  { href: '/log', label: '記録', icon: '✏️' },
  { href: '/history', label: '履歴', icon: '📅' },
  { href: '/coach', label: 'AI助言', icon: '💡' },
  { href: '/chat', label: 'AIチャット', icon: '💬' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 h-16 bg-white border-t border-gray-200 grid grid-cols-7 z-40 md:relative md:max-w-2xl md:mx-auto md:mt-8 md:rounded-xl md:border md:shadow-sm">
      {items.map((item) => {
        const active =
          item.href === '/'
            ? pathname === '/'
            : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center text-[10px] gap-0.5 leading-tight px-1 text-center ${
              active ? 'text-blue-600 font-semibold' : 'text-gray-500'
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
      <form action={logoutAction} className="contents">
        <button
          type="submit"
          className="flex flex-col items-center justify-center text-[10px] gap-0.5 leading-tight px-1 text-center text-gray-500 hover:text-red-500"
          aria-label="ログアウト"
        >
          <span className="text-lg leading-none">🚪</span>
          <span>ログアウト</span>
        </button>
      </form>
    </nav>
  );
}
