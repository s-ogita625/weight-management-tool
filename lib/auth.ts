import 'server-only';

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';

const COOKIE_NAME = 'wm_session';
const SESSION_DAYS = 30;

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET is not set or too short (need ≥32 chars). Set it in .env.local / Vercel env.',
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60;
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(exp * 1000),
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'],
    });
    const uid = payload.uid;
    return typeof uid === 'string' ? uid : null;
  } catch {
    return null;
  }
}

export interface AuthUser {
  id: string;
  email: string;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const rows = (await sql`
    select id, email from users where id = ${userId} limit 1
  `) as { id: string; email: string }[];
  return rows[0] ?? null;
}

export async function signup(
  email: string,
  password: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: 'メールアドレスが正しくありません' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'パスワードは6文字以上にしてください' };
  }
  const exists = (await sql`
    select 1 from users where email = ${cleanEmail} limit 1
  `) as unknown[];
  if (exists.length > 0) {
    return { ok: false, error: 'このメールアドレスはすでに登録されています' };
  }
  const hash = await hashPassword(password);
  const rows = (await sql`
    insert into users (email, password_hash)
    values (${cleanEmail}, ${hash})
    returning id
  `) as { id: string }[];
  return { ok: true, userId: rows[0].id };
}

export async function login(
  email: string,
  password: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const rows = (await sql`
    select id, password_hash from users where email = ${cleanEmail} limit 1
  `) as { id: string; password_hash: string }[];
  if (rows.length === 0) {
    return { ok: false, error: 'メールアドレスまたはパスワードが違います' };
  }
  const ok = await verifyPassword(password, rows[0].password_hash);
  if (!ok) {
    return { ok: false, error: 'メールアドレスまたはパスワードが違います' };
  }
  return { ok: true, userId: rows[0].id };
}
