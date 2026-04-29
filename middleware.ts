import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PROTECTED_PATHS = [
  '/onboarding',
  '/plan',
  '/log',
  '/history',
  '/coach',
  '/chat',
];
const AUTH_PATHS = ['/login', '/signup'];
const COOKIE_NAME = 'wm_session';

async function verify(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
    });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtected = PROTECTED_PATHS.some((p) => path.startsWith(p));
  const isAuth = AUTH_PATHS.some((p) => path.startsWith(p));
  if (!isProtected && !isAuth) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const ok = await verify(token);

  if (isProtected && !ok) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (isAuth && ok) {
    const url = req.nextUrl.clone();
    url.pathname = '/plan';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
