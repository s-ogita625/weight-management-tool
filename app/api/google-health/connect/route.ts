import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { buildAuthUrl, googleHealthConfigured } from '@/lib/google-health';

export const dynamic = 'force-dynamic';

/** Google の同意画面へ移動（CSRF 対策の state を Cookie に保存） */
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(new URL('/login', req.url));
  if (!googleHealthConfigured()) {
    return NextResponse.redirect(new URL('/settings/health?error=not_configured', req.url));
  }
  const state = randomBytes(24).toString('base64url');
  const cookieStore = await cookies();
  cookieStore.set('gh_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/google-health',
    maxAge: 600,
  });
  return NextResponse.redirect(buildAuthUrl(req.nextUrl.origin, state));
}
