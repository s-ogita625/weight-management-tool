import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { dateInJST } from '@/lib/date';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 一時デバッグ用：本番が実際にどの DB に繋がっているかを確認する。
 * ホスト名のみ返す（パスワードは返さない）。問題解決後に削除。
 */
export async function GET() {
  const url = process.env.DATABASE_URL ?? '';
  let host = 'NOT_SET';
  try {
    if (url) {
      const m = url.match(/@([^/]+)/);
      host = m ? m[1] : 'UNPARSEABLE';
    }
  } catch {}

  // 接続テスト + 件数
  let totalUsers = -1;
  let totalMeals = -1;
  let mealsToday = -1;
  let totalProfiles = -1;
  let firstUserId: string | null = null;
  const today = dateInJST();

  try {
    const r1 = (await sql`select count(*)::int as c from users`) as unknown as Array<{ c: number }>;
    totalUsers = r1[0]?.c ?? 0;
    const r2 = (await sql`select count(*)::int as c from meal_logs`) as unknown as Array<{ c: number }>;
    totalMeals = r2[0]?.c ?? 0;
    const r3 = (await sql`select count(*)::int as c from meal_logs where date = ${today}`) as unknown as Array<{ c: number }>;
    mealsToday = r3[0]?.c ?? 0;
    const r4 = (await sql`select count(*)::int as c from profiles`) as unknown as Array<{ c: number }>;
    totalProfiles = r4[0]?.c ?? 0;
    const r5 = (await sql`select id from users limit 1`) as unknown as Array<{ id: string }>;
    firstUserId = r5[0]?.id ?? null;
  } catch (e) {
    return NextResponse.json({
      dbHost: host,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return NextResponse.json({
    dbHost: host,
    jstToday: today,
    totals: {
      users: totalUsers,
      meal_logs: totalMeals,
      meal_logs_today: mealsToday,
      profiles: totalProfiles,
    },
    firstUserId,
  });
}
