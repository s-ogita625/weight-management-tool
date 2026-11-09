/** 毎朝の Google Health 同期（Vercel Cron） */
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { googleHealthConfigured, syncGoogleHealth } from '@/lib/google-health';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!googleHealthConfigured()) return NextResponse.json({ skipped: 'not configured' });
  const users = (await sql`select user_id from health_connections`) as unknown as Array<{ user_id: string }>;
  let ok = 0;
  for (const u of users) {
    try {
      await syncGoogleHealth(u.user_id, 3);
      ok++;
    } catch {
      // エラーは health_connections.last_error に記録済み
    }
  }
  return NextResponse.json({ users: users.length, ok });
}
