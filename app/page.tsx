import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { dateInJST } from '@/lib/date';
import { sql } from '@/lib/db';
import type { DailyLog, MealLog, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const userId = await getSessionUserId();

  if (!userId) {
    return (
      <div className="py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
          体重管理ツール
        </h1>
        <p className="text-gray-600 leading-relaxed mb-6">
          身体データと目標から、エビデンスに基づいた食事プラン（カロリー・PFC栄養）を算出します。
        </p>
        <ul className="space-y-2 text-sm text-gray-700 mb-8 bg-white rounded-xl p-4 border border-gray-200">
          <li>✓ Mifflin-St Jeor / Katch-McArdle 式の比較計算</li>
          <li>✓ 食事ごとの記録（カロリー・PFC・時刻・区分）</li>
          <li>✓ 朝の体重・体脂肪・コンディション記録</li>
          <li>✓ 体重推移グラフ・線形回帰予測</li>
          <li>✓ AIコーチング（あなたの記録に基づくアドバイス）</li>
          <li>✓ AIチャット（質問にスポーツ栄養士視点で回答）</li>
          <li>✓ 家計簿（食費連携）</li>
        </ul>
        <div className="flex flex-col gap-3">
          <Link
            href="/signup"
            className="h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
          >
            新規登録ではじめる
          </Link>
          <Link
            href="/login"
            className="h-12 flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold rounded-xl"
          >
            ログイン
          </Link>
        </div>
      </div>
    );
  }

  // プロフィール未登録なら強制 onboarding
  const profileRows = (await sql`
    select * from profiles where user_id = ${userId} limit 1
  `) as unknown as Profile[];
  if (profileRows.length === 0) redirect('/onboarding');
  const profile = profileRows[0];

  // 今日の朝記録
  const today = dateInJST();
  const morningRows = (await sql`
    select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
           weight_kg, body_fat_pct, sleep_hours, sleep_quality, fatigue, mood, bowel
    from daily_logs
    where user_id = ${userId} and date = ${today}
    limit 1
  `) as unknown as DailyLog[];
  const morning = morningRows[0] ?? null;

  // 今日の食事合計
  const mealRows = (await sql`
    select calories, protein_g, fat_g, carbs_g
    from meal_logs
    where user_id = ${userId} and date = ${today}
  `) as unknown as MealLog[];
  const mealTotal = mealRows.reduce(
    (a, r) => ({
      calories: a.calories + Number(r.calories),
      protein_g: a.protein_g + Number(r.protein_g),
      fat_g: a.fat_g + Number(r.fat_g),
      carbs_g: a.carbs_g + Number(r.carbs_g),
    }),
    { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 },
  );

  // 今月の家計
  const ym = today.slice(0, 7);
  const start = `${ym}-01`;
  const txTotalsRows = (await sql`
    select kind, coalesce(sum(amount),0)::float as total
    from transactions
    where user_id = ${userId} and date >= ${start}
    group by kind
  `) as unknown as Array<{ kind: 'income' | 'expense'; total: number }>;
  const income = txTotalsRows.find((r) => r.kind === 'income')?.total ?? 0;
  const expense = txTotalsRows.find((r) => r.kind === 'expense')?.total ?? 0;

  return (
    <div className="py-4 space-y-5">
      <h1 className="text-2xl font-bold">今日のサマリー</h1>
      <p className="text-sm text-gray-600">{today}</p>

      {/* 朝の記録カード */}
      <ShortcutCard
        href="/morning"
        title={morning ? '朝の記録 ✓' : '朝の記録を入力'}
        bg={morning ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}
      >
        {morning ? (
          <div className="text-sm text-gray-700 space-y-0.5">
            {morning.weight_kg !== null && (
              <div>
                体重:{' '}
                <span className="font-semibold tabular-nums">
                  {Number(morning.weight_kg).toFixed(1)}kg
                </span>
              </div>
            )}
            {morning.body_fat_pct !== null && (
              <div>
                体脂肪:{' '}
                <span className="font-semibold tabular-nums">
                  {Number(morning.body_fat_pct).toFixed(1)}%
                </span>
              </div>
            )}
            {morning.sleep_hours !== null && (
              <div>
                睡眠:{' '}
                <span className="font-semibold tabular-nums">
                  {Number(morning.sleep_hours).toFixed(1)}h
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-700">
            体重・体脂肪率・コンディションを記録しましょう
          </div>
        )}
      </ShortcutCard>

      {/* 食事サマリー */}
      <ShortcutCard
        href="/log"
        title="食事を記録"
        bg="bg-white border-gray-200"
      >
        <div className="text-sm text-gray-700">
          <div className="text-lg font-bold tabular-nums">
            {Math.round(mealTotal.calories).toLocaleString()} kcal
            <span className="text-xs font-normal text-gray-500 ml-1">
              / {mealRows.length}件
            </span>
          </div>
          <div className="text-xs text-gray-600">
            P{Math.round(mealTotal.protein_g)} F
            {Math.round(mealTotal.fat_g)} C{Math.round(mealTotal.carbs_g)}
          </div>
        </div>
      </ShortcutCard>

      {/* 家計サマリー */}
      <ShortcutCard
        href="/budget"
        title={`今月（${ym}）の家計`}
        bg="bg-white border-gray-200"
      >
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-gray-500">収入</div>
            <div className="font-semibold tabular-nums text-emerald-600">
              ¥{income.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-gray-500">支出</div>
            <div className="font-semibold tabular-nums text-rose-600">
              ¥{expense.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-gray-500">収支</div>
            <div
              className={`font-semibold tabular-nums ${
                income - expense >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              ¥{(income - expense).toLocaleString()}
            </div>
          </div>
        </div>
      </ShortcutCard>

      {/* クイックリンク */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          クイックリンク
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <QuickLink href="/plan" icon="📊" label="食事プラン" />
          <QuickLink href="/trend" icon="📈" label="トレンド分析" />
          <QuickLink href="/history" icon="📅" label="食事履歴" />
          <QuickLink href="/coach" icon="💡" label="AIコーチング" />
          <QuickLink href="/chat" icon="💬" label="AIチャット" />
          <QuickLink href="/onboarding" icon="⚙️" label="プロフィール" />
        </div>
      </div>

      <div className="text-xs text-gray-500 text-center">
        現在の目標: {Number(profile.target_weight_kg).toFixed(1)}kg /
        体脂肪{Number(profile.target_body_fat_pct).toFixed(1)}%
      </div>
    </div>
  );
}

function ShortcutCard({
  href,
  title,
  bg,
  children,
}: {
  href: string;
  title: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-xl border p-4 active:scale-[0.99] transition ${bg}`}
    >
      <div className="text-sm font-semibold text-gray-800 mb-1">{title} →</div>
      {children}
    </Link>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-3 hover:bg-gray-50 active:scale-[0.99] transition"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}
