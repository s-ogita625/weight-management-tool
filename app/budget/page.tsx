import Link from 'next/link';
import { redirect } from 'next/navigation';
import TransactionForm from '@/components/forms/TransactionForm';
import TransactionList from '@/components/budget/TransactionList';
import { getSessionUserId } from '@/lib/auth';
import { dateInJST } from '@/lib/date';
import { sql } from '@/lib/db';
import { getRecurringForMonth } from '@/lib/recurring';
import type { Transaction } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  searchParams: Promise<{ ym?: string }>;
}

function currentYearMonth(): string {
  return dateInJST().slice(0, 7);
}

function ymToRange(ym: string): { start: string; end: string } {
  const [yStr, mStr] = ym.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const start = `${ym}-01`;
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

  // 当月のトランザクション、固定費、食事記録件数を並列取得
  const [txRowsRaw, recurring, mealCountRowsRaw] = await Promise.all([
    sql`
      select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
             kind, category, amount, memo, created_at
      from transactions
      where user_id = ${userId}
        and date >= ${start} and date < ${end}
      order by date desc, created_at desc
    `,
    getRecurringForMonth(userId, ym),
    sql`
      select count(*)::int as cnt
      from meal_logs
      where user_id = ${userId}
        and date >= ${start} and date < ${end}
    `,
  ]);
  const txItems = txRowsRaw as unknown as Transaction[];
  const recurringTotal = recurring.reduce((a, r) => a + Number(r.amount), 0);

  // トランザクション集計
  const txTotals = txItems.reduce(
    (acc, t) => {
      const amt = Number(t.amount);
      if (t.kind === 'income') acc.income += amt;
      else acc.expense += amt;
      return acc;
    },
    { income: 0, expense: 0 },
  );
  // 固定費を支出に加算した実効値
  const effectiveExpense = txTotals.expense + recurringTotal;
  const net = txTotals.income - effectiveExpense;

  // カテゴリ別集計（支出）— トランザクション + 固定費
  const categoryMap = new Map<string, number>();
  for (const t of txItems) {
    if (t.kind === 'expense') {
      categoryMap.set(t.category, (categoryMap.get(t.category) ?? 0) + Number(t.amount));
    }
  }
  for (const r of recurring) {
    categoryMap.set(r.category, (categoryMap.get(r.category) ?? 0) + Number(r.amount));
  }
  const categories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      category,
      amount,
      pct:
        effectiveExpense > 0
          ? Math.round((amount / effectiveExpense) * 100)
          : 0,
    }));

  // 食費（トランザクション分のみ。固定費に「食費」が登録されていれば足す）
  const foodSpendTx =
    (txItems
      .filter((t) => t.kind === 'expense' && (t.category === '食費' || t.category === '外食'))
      .reduce((a, t) => a + Number(t.amount), 0));
  const foodSpendRecurring = recurring
    .filter((r) => r.category === '食費' || r.category === '外食')
    .reduce((a, r) => a + Number(r.amount), 0);
  const foodSpend = foodSpendTx + foodSpendRecurring;

  // 日数
  const today = dateInJST();
  const daysInMonth =
    new Date(Number(ym.split('-')[0]), Number(ym.split('-')[1]), 0).getDate();
  const elapsedDays = today.startsWith(ym)
    ? Number(today.slice(8, 10))
    : daysInMonth;
  const dailyFoodAvg = elapsedDays > 0 ? Math.round(foodSpend / elapsedDays) : 0;

  // 食事記録件数（並列取得済み）
  const mealCountRows = mealCountRowsRaw as unknown as Array<{ cnt: number }>;
  const mealCount = mealCountRows[0]?.cnt ?? 0;

  const prevYM = shiftMonth(ym, -1);
  const nextYM = shiftMonth(ym, 1);

  return (
    <div className="py-4 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">家計簿</h1>
        <Link
          href="/budget/recurring"
          className="text-sm text-blue-600 underline"
        >
          固定費の管理 →
        </Link>
      </div>

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
          value={txTotals.income}
          color="text-emerald-600"
        />
        <SummaryCard
          label="支出"
          value={effectiveExpense}
          color="text-rose-600"
          subLabel={
            recurringTotal > 0
              ? `固定費 ¥${recurringTotal.toLocaleString()} 含む`
              : undefined
          }
        />
        <SummaryCard
          label="収支"
          value={net}
          color={net >= 0 ? 'text-emerald-600' : 'text-rose-600'}
        />
      </div>

      {/* 固定費の内訳 */}
      {recurring.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-gray-700">
              📌 当月の固定費 ({recurring.length}件)
            </div>
            <Link
              href="/budget/recurring"
              className="text-xs text-blue-600 underline"
            >
              編集
            </Link>
          </div>
          <ul className="divide-y divide-gray-100 text-sm">
            {recurring.map((r) => (
              <li key={r.id} className="py-2 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      {r.category}
                    </span>
                    <span className="text-xs text-gray-500">
                      毎月{r.billing_day}日
                    </span>
                  </div>
                  {r.purpose && (
                    <div className="text-xs text-gray-600 mt-0.5 truncate">
                      {r.purpose}
                    </div>
                  )}
                </div>
                <div className="font-semibold tabular-nums whitespace-nowrap">
                  ¥{Number(r.amount).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between text-sm">
            <span className="font-semibold text-gray-700">小計</span>
            <span className="font-bold tabular-nums">
              ¥{recurringTotal.toLocaleString()}
            </span>
          </div>
        </div>
      )}

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
        {txTotals.income > 0 && foodSpend > 0 && (
          <div className="text-xs text-gray-500 mt-2">
            食費は収入の約 {Math.round((foodSpend / txTotals.income) * 100)}%
            （一般的な目安は15-25%）
          </div>
        )}
      </div>

      {/* カテゴリ別集計（支出） */}
      {categories.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">
            支出カテゴリ別（固定費含む）
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
          新しい収支を記録（変動費・収入）
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
  subLabel,
}: {
  label: string;
  value: number;
  color: string;
  subLabel?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${color}`}>
        ¥{value.toLocaleString()}
      </div>
      {subLabel && (
        <div className="text-[10px] text-gray-400 mt-0.5">{subLabel}</div>
      )}
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
