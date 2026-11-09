import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { connectWithCode, syncGoogleHealth } from '@/lib/google-health';

export const dynamic = 'force-dynamic';

function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/settings/health?${q}`, req.url));
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(new URL('/login', req.url));

  const cookieStore = await cookies();
  const expected = cookieStore.get('gh_oauth_state')?.value ?? '';
  cookieStore.delete({ name: 'gh_oauth_state', path: '/api/google-health' });

  const params = req.nextUrl.searchParams;
  if (params.get('error')) return back('error=denied');
  const state = params.get('state') ?? '';
  const code = params.get('code') ?? '';
  if (!expected || !state || !sameState(expected, state) || !code) return back('error=state');

  try {
    await connectWithCode(userId, code, req.nextUrl.origin);
  } catch {
    return back('error=token');
  }
  try {
    await syncGoogleHealth(userId, 30); // 初回は30日分
  } catch {
    return back('connected=1&sync=failed');
  }
  return back('connected=1');
}
