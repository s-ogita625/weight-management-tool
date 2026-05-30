'use client';

import {
  BarChart3,
  Bot,
  CalendarDays,
  Dumbbell,
  History,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Settings,
  Sparkles,
  Sunrise,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logoutAction } from '@/app/actions/auth';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const mainItems: NavItem[] = [
  { href: '/', label: 'ホーム', icon: Home },
  { href: '/morning', label: '朝記録', icon: Sunrise },
  { href: '/log', label: '食事', icon: Utensils },
  { href: '/workout', label: '筋トレ', icon: Dumbbell },
];

const moreItems: NavItem[] = [
  { href: '/plan', label: '食事プラン', icon: BarChart3 },
  { href: '/calendar', label: '記録カレンダー', icon: CalendarDays },
  { href: '/trend', label: 'トレンド分析', icon: Sparkles },
  { href: '/history', label: '食事履歴', icon: History },
  { href: '/coach', label: 'AIコーチング', icon: Bot },
  { href: '/chat', label: 'AIチャット', icon: MessageCircle },
  { href: '/research', label: '文献リサーチ', icon: Moon },
  { href: '/onboarding', label: 'プロフィール編集', icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

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
      <nav className="fixed bottom-0 inset-x-0 z-40 grid h-[72px] grid-cols-5 border-t border-white/10 bg-[#080c13]/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-18px_45px_rgba(0,0,0,0.42)] backdrop-blur-xl md:relative md:mx-auto md:mt-8 md:max-w-2xl md:rounded-lg md:border">
        {mainItems.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center gap-1 px-1 text-center text-[10px] font-semibold leading-tight transition ${
                active ? 'text-[#a3ff12]' : 'text-slate-400 hover:text-white'
              }`}
            >
              {active && (
                <span className="absolute top-1 h-1 w-8 rounded-full bg-[#a3ff12] shadow-[0_0_18px_rgba(163,255,18,0.8)]" />
              )}
              <Icon size={20} strokeWidth={2.2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-1 px-1 text-center text-[10px] font-semibold leading-tight text-slate-400 transition hover:text-white"
          aria-label="メニュー"
        >
          <Menu size={20} strokeWidth={2.2} />
          <span>メニュー</span>
        </button>
      </nav>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="fixed bottom-0 inset-x-0 z-50 max-h-[82vh] overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0b1018] pb-6 shadow-2xl">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <div>
                <div className="sport-kicker">Control deck</div>
                <h3 className="text-lg font-black">メニュー</h3>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-300"
                aria-label="閉じる"
              >
                <X size={20} />
              </button>
            </div>
            <ul className="grid grid-cols-1 gap-2 px-4 py-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-3 transition hover:border-[#a3ff12]/50 hover:bg-[#a3ff12]/10"
                    >
                      <Icon size={20} className="text-[#a3ff12]" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
              <li>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-3 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-3 text-left text-rose-300 transition hover:bg-rose-500/15"
                  >
                    <LogOut size={20} />
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
