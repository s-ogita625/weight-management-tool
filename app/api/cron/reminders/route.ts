/**
 * 記録リマインド（Vercel Cron から1日2回呼ばれる）
 * - morning (10:00 JST): 今日の体重が未記録なら通知
 * - evening (21:00 JST): 今日の食事記録が2件未満なら通知
 */
import { NextResponse, type NextRequest } from 'next/server';
import { dateInJST } from '@/lib/date';
import { sql } from '@/lib/db';
import { pushConfigured, sendPushToUser } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ skipped: 'vapid keys not configured' });
  }

  const slot = req.nextUrl.searchParams.get('slot') === 'evening' ? 'evening' : 'morning';
  const today = dateInJST();

  const targets =
    slot === 'morning'
      ? ((await sql`
          select distinct ps.user_id
          from push_subscriptions ps
          where not exists (
            select 1 from daily_logs d
            where d.user_id = ps.user_id and d.date = ${today} and d.weight_kg is not null
          )
        `) as unknown as Array<{ user_id: string }>)
      : ((await sql`
          select ps.user_id, coalesce(m.n, 0)::int as n
          from (select distinct user_id from push_subscriptions) ps
          left join (
            select user_id, count(*) as n from meal_logs where date = ${today} group by user_id
          ) m on m.user_id = ps.user_id
          where coalesce(m.n, 0) < 2
        `) as unknown as Array<{ user_id: string; n?: number }>);

  let sent = 0;
  for (const t of targets) {
    sent += await sendPushToUser(
      t.user_id,
      slot === 'morning'
        ? {
            title: '体重を記録しましょう ⚖️',
            body: '体重だけなら10秒。体調はいつも通りボタンでOK',
            url: '/',
            tag: 'weight',
          }
        : {
            title: `今日の食事記録が${'n' in t ? t.n : 0}件です 🍽️`,
            body: '思い出せなければ「ざっくり記録」で1タップ。0日にしないのがコツ',
            url: '/',
            tag: 'meal',
          },
    );
  }
  return NextResponse.json({ slot, users: targets.length, sent });
}
