import 'server-only';

import { sql } from '@/lib/db';
import type { RecurringExpense } from '@/lib/types';

/**
 * 指定月 (YYYY-MM) に有効な固定費を返す。
 * is_active かつ start_month <= ym かつ (end_month is null or end_month >= ym)
 */
export async function getRecurringForMonth(
  userId: string,
  ym: string,
): Promise<RecurringExpense[]> {
  const rows = (await sql`
    select id, user_id, name, category, amount, billing_day,
           purpose, start_month, end_month, is_active,
           created_at, updated_at
    from recurring_expenses
    where user_id = ${userId}
      and is_active = true
      and start_month <= ${ym}
      and (end_month is null or end_month >= ${ym})
    order by billing_day asc, name asc
  `) as unknown as RecurringExpense[];
  return rows;
}

/** 月の有効固定費の合計額 */
export async function getRecurringMonthlyTotal(
  userId: string,
  ym: string,
): Promise<number> {
  const rows = await getRecurringForMonth(userId, ym);
  return rows.reduce((a, r) => a + Number(r.amount), 0);
}
