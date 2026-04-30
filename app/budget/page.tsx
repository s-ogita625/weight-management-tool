import Link from 'next/link';
import { redirect } from 'next/navigation';
import TransactionForm from '@/components/forms/TransactionForm';
import TransactionList from '@/components/budget/TransactionList';
import { getSessionUserId } from '@/lib/auth';
import { dateInJST } from '@/lib/date';
import { sql } from '@/lib/db';
import type { Transaction } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  searchParams: Promise<{ ym?: string }>;
}

function currentYearMonth(): string {
  return dateInJST().slice(0, 7); // YYYY-MM
}

function ymToRange(ym: string): { start: string; end: string } {
  // YYYY-MM の月初・月末
  const [yStr, mStr] = ym.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const start = `${ym}-01`;
  // 翌月1日
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { start, end: next };
}

function shiftMonth(ym: string, delta: number): string {
  const [yStr, mStr] = ym.split('-');
  let y = Number(yStr);
  let m = Number(mStr) + delta;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export default async function BudgetPage({ searchParams }: Props) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const sp = await searchParams;
  const ym = sp?.ym ?? currentYearMonth();
  const { start, end } = ymToRange(ym);

  // 当月のトランザクション
  const txRowsRaw = await sql`
    select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
           kind, category, amount, memo, created_at
    from transactions
    where user_id = ${userId}
      and date >= ${start} and date < ${end}
    order by date desc, created_at desc
  `;
  const txItems = txRowsRaw as unknown as Transaction[];

  // 集計
  const totals = txItems.reduce(
    (acc, t) => {
      const amt = Number(t.amount);
      if (t.kind === 'income') acc.income += amt;
      else acc.expense += amt;
      return acc;
    },
    { income: 0, expense: 0 },
  );
  const net = totals.income - totals.expense;

  // カテゴリ別集計（支出）
  const categoryMap = new Map<string, number>();
  for (const t of txItems) {
    if (t.kind === 'expense') {
      categoryMap.set(t.category, (categoryMap.get(t.category) ?? 0) + Number(t.amount));
    }
  }
  const categories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      category,
      amount,
      pct: totals.expense > 0 ? Math.round((amount / totals.expense) * 100) : 0,
    }));

  // 食事記録から食費の参考データ（meal_logs はカロリー記録なので、食費は手動。ただし「食費」「外食」カテゴリの実績を抽出）
  const foodSpend =
    (categoryMap.get('食費') ?? 0) + (categoryMap.get('外食') ?? 0);

  // 日数
  const today = dateInJST();
  const daysInMonth =
    new Date(Number(ym.split('-')[0]), Number(ym.split('-')[1]), 0).getDate();
  const elapsedDays = today.startsWith(ym)
    ? Number(today.slice(8, 10))
    : daysInMonth;
  const dailyFoodAvg = elapsedDays > 0 ? Math.round(foodSpend / elapsedDays) : 0;

  // 食事記録件数（meal_logs）から「実際の食事回数」も参考に
  const mealCountRows = (await sql`
    select count(*)::int as cnt
    from meal_logs
    where user_id = ${userId}
      and date >= ${start} and date < ${end}
  `) as unknown as Array<{ cnt: number }>;
  const mealCount = mealCountRows[0]?.cnt ?? 0;

  const prevYM = shiftMonth(ym, -1);
  const nextYM = shiftMonth(ym, 1);

  return (
    <div className="py-4 space-y-5">
      <h1 className="text-2xl font-bold">家計簿</h1>

      {/* 月切替 */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-2">
        <Link
          href={`/budget?ym=${prevYM}`}
          className="px-3 py-2 text-sm text-blue-600 hover:underline"
        >
          ← {prevYM}
        </Link>
        <div className="font-semibold">{ym}</div>
        <Link
          href={`/budget?ym=${nextYM}`}
          className="px-3 py-2 text-sm text-blue-600 hover:underline"
        >
          {nextYM} →
        </Link>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard
          label="収入"
          value={totals.income}
          color="text-emerald-600"
        />
        <SummaryCard
          label="支出"
          value={totals.expense}
          color="text-rose-600"
        />
        <SummaryCard
          label="収支"
          value={net}
          color={net >= 0 ? 'text-emerald-600' : 'text-rose-600'}
        />
      </div>

      {/* 食費連携 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm font-semibold text-gray-700 mb-2">
          🍽️ 食費の状況
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Stat label="食費合計" value={`¥${foodSpend.toLocaleString()}`} />
          <Stat
            label="1日あたり"
            value={`¥${dailyFoodAvg.toLocaleString()}`}
          />
          <Stat label="食事記録" value={`${mealCount}件`} />
        </div>
        {totals.income > 0 && foodSpend > 0 && (
          <div className="text-xs text-gray-500 mt-2">
            食費は収入の約 {Math.round((foodSpend / totals.income) * 100)}%
            （一般的な目安は15-25%）
          </div>
        )}
      </div>

      {/* カテゴリ別集計（支出） */}
      {categories.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">
            支出カテゴリ別
          </div>
          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.category}>
                <div className="flex items-center justify-between text-sm">
                  <span>{c.category}</span>
                  <span className="tabular-nums">
                    ¥{c.amount.toLocaleString()}{' '}
                    <span className="text-xs text-gray-500">({c.pct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-rose-400"
                    style={{ width: `${c.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 入力フォーム */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          新しい収支を記録
        </h2>
        <TransactionForm />
      </div>

      {/* 当月の一覧 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          {ym} の記録 ({txItems.length}件)
        </h2>
        <TransactionList items={txItems} />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${color}`}>
        ¥{value.toLocaleString()}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}
