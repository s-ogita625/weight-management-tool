import Link from 'next/link';
import { redirect } from 'next/navigation';
import RecurringForm from '@/components/forms/RecurringForm';
import RecurringList from '@/components/budget/RecurringList';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import type { RecurringExpense } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RecurringPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const rows = (await sql`
    select id, user_id, name, category, amount, billing_day,
           purpose, start_month, end_month, is_active,
           created_at, updated_at
    from recurring_expenses
    where user_id = ${userId}
    order by is_active desc, billing_day asc, name asc
  `) as unknown as RecurringExpense[];

  // 有効な固定費の月額合計
  const activeMonthly = rows
    .filter((r) => r.is_active)
    .reduce((a, r) => a + Number(r.amount), 0);

  return (
    <div className="py-4 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/budget" className="text-blue-600 text-sm">
          ← 家計簿
        </Link>
      </div>
      <h1 className="text-2xl font-bold">固定費の管理</h1>
      <p className="text-sm text-gray-600">
        家賃・サブスク・ジムなど毎月決まって発生する費用を登録すると、家計簿の月集計に自動で加算されます（実トランザクションは作成しません）。
      </p>

      {/* 月額合計 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-xs text-gray-500">有効な固定費の月額合計</div>
        <div className="text-2xl font-bold tabular-nums">
          ¥{activeMonthly.toLocaleString()}
          <span className="text-sm font-normal text-gray-500 ml-2">
            ({rows.filter((r) => r.is_active).length}件)
          </span>
        </div>
      </div>

      {/* 一覧 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          登録済みの固定費 ({rows.length}件)
        </h2>
        <RecurringList items={rows} />
      </div>

      {/* 新規追加フォーム */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">
          新しい固定費を登録
        </h2>
        <RecurringForm />
      </div>
    </div>
  );
}
