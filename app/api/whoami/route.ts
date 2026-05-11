import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import { dateInJST } from '@/lib/date';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 一時デバッグ用：ログイン中ユーザーの userId とデータ件数を返す。
 * 問題解決後は削除すること。
 */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({
      authenticated: false,
      message: 'No valid session cookie',
    });
  }

  const userInfo = (await sql`
    select id, email, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
    from users where id = ${userId}
  `) as unknown as Array<{ id: string; email: string; created_at: string }>;

  const today = dateInJST();
  const mealCounts = (await sql`
    select count(*)::int as today_count,
      (select count(*)::int from meal_logs where user_id = ${userId}) as total
    from meal_logs
    where user_id = ${userId} and date = ${today}
  `) as unknown as Array<{ today_count: number; total: number }>;

  const dailyLogCount = (await sql`
    select count(*)::int as cnt from daily_logs where user_id = ${userId}
  `) as unknown as Array<{ cnt: number }>;

  const transactionsCount = (await sql`
    select count(*)::int as cnt from transactions where user_id = ${userId}
  `) as unknown as Array<{ cnt: number }>;

  const profileCount = (await sql`
    select count(*)::int as cnt from profiles where user_id = ${userId}
  `) as unknown as Array<{ cnt: number }>;

  return NextResponse.json({
    authenticated: true,
    userId,
    userInDb: userInfo[0] ?? null,
    jstToday: today,
    counts: {
      meal_logs_today: mealCounts[0]?.today_count ?? 0,
      meal_logs_total: mealCounts[0]?.total ?? 0,
      daily_logs: dailyLogCount[0]?.cnt ?? 0,
      transactions: transactionsCount[0]?.cnt ?? 0,
      profiles: profileCount[0]?.cnt ?? 0,
    },
  });
}
