'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const items = [
  { href: '/', label: 'ホーム', icon: '🏠' },
  { href: '/plan', label: 'プラン', icon: '📊' },
  { href: '/log', label: '記録', icon: '✏️' },
  { href: '/history', label: '履歴', icon: '📅' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 h-16 bg-white border-t border-gray-200 grid grid-cols-5 z-40 md:relative md:max-w-2xl md:mx-auto md:mt-8 md:rounded-xl md:border md:shadow-sm">
      {items.map((item) => {
        const active =
          item.href === '/'
            ? pathname === '/'
            : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center text-xs gap-0.5 ${
              active ? 'text-blue-600 font-semibold' : 'text-gray-500'
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button
        onClick={handleLogout}
        className="flex flex-col items-center justify-center text-xs gap-0.5 text-gray-500 hover:text-red-500"
        aria-label="ログアウト"
      >
        <span className="text-xl leading-none">🚪</span>
        <span>ログアウト</span>
      </button>
    </nav>
  );
}
