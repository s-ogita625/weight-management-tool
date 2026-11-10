import 'server-only';

/**
 * Google Health API v4（Fitbit Air / Pixel Watch / Fitbit のデータ）連携。
 * - OAuth 2.0（Web サーバー型クライアント、オフラインアクセス）
 * - 1日ごとの歩数・消費カロリー・距離・アクティブゾーン分、睡眠、運動を同期
 * 参照: https://developers.google.com/health/reference/rest
 */

import { dateInJST } from '@/lib/date';
import { sql } from '@/lib/db';
import {
  distanceToKm,
  exercisesByDate,
  hrvByDate,
  restingHrByDate,
  rollupByDate,
  sleepByWakeDate,
  toCivilDate,
  type WearableDay,
} from '@/lib/google-health-parse';
import { decryptSecret, encryptSecret } from '@/lib/secret-box';
import { addDays } from '@/lib/stats';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://health.googleapis.com/v4/users/me';
export const HEALTH_METRICS_SCOPE =
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly';

/** 保存済みのスコープに安静時心拍・HRV の権限が含まれているか */
export function hasHealthMetricsScope(scopes: string | null | undefined): boolean {
  return (scopes ?? '').split(/\s+/).includes(HEALTH_METRICS_SCOPE);
}

export const GOOGLE_HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  // 安静時心拍・HRV（回復度＝疲労度の推定に使う）
  HEALTH_METRICS_SCOPE,
];

export function googleHealthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_HEALTH_CLIENT_ID && process.env.GOOGLE_HEALTH_CLIENT_SECRET);
}

export function redirectUri(origin: string): string {
  return `${origin}/api/google-health/callback`;
}

export function buildAuthUrl(origin: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_HEALTH_CLIENT_ID ?? '',
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent', // refresh_token を確実にもらう
    scope: GOOGLE_HEALTH_SCOPES.join(' '),
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_HEALTH_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET ?? '',
      ...params,
    }),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`token request failed: ${json.error ?? res.status}`);
  }
  return json;
}

/** 認可コードをトークンに交換して保存 */
export async function connectWithCode(userId: string, code: string, origin: string): Promise<void> {
  const t = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(origin),
  });
  if (!t.refresh_token) throw new Error('refresh_token が返されませんでした');
  const expiresAt = new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString();
  await sql`
    insert into health_connections (user_id, refresh_token_enc, access_token_enc, access_expires_at, scopes, last_error)
    values (${userId}, ${encryptSecret(t.refresh_token)}, ${encryptSecret(t.access_token)}, ${expiresAt}, ${t.scope ?? ''}, null)
    on conflict (user_id) do update set
      refresh_token_enc = excluded.refresh_token_enc,
      access_token_enc = excluded.access_token_enc,
      access_expires_at = excluded.access_expires_at,
      scopes = excluded.scopes,
      connected_at = now(),
      last_error = null
  `;
}

interface ConnectionRow {
  refresh_token_enc: string;
  access_token_enc: string | null;
  access_expires_at: string | null;
}

async function getAccessToken(userId: string): Promise<string | null> {
  const rows = (await sql`
    select refresh_token_enc, access_token_enc, access_expires_at
    from health_connections where user_id = ${userId}
  `) as unknown as ConnectionRow[];
  const row = rows[0];
  if (!row) return null;
  if (row.access_token_enc && row.access_expires_at && new Date(row.access_expires_at) > new Date()) {
    return decryptSecret(row.access_token_enc);
  }
  const t = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: decryptSecret(row.refresh_token_enc),
  });
  const expiresAt = new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString();
  await sql`
    update health_connections set
      access_token_enc = ${encryptSecret(t.access_token)},
      access_expires_at = ${expiresAt}
    where user_id = ${userId}
  `;
  return t.access_token;
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google Health API ${res.status} ${path.split('?')[0]}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function dailyRollUp(token: string, dataType: string, start: string, endExclusive: string) {
  const json = await api<{ rollupDataPoints?: Array<Record<string, unknown>> }>(
    token,
    `/dataTypes/${dataType}/dataPoints:dailyRollUp`,
    {
      method: 'POST',
      body: JSON.stringify({
        range: { start: { date: toCivilDate(start) }, end: { date: toCivilDate(endExclusive) } },
        windowSizeDays: 1,
      }),
    },
  );
  return json.rollupDataPoints ?? [];
}

async function listAll<T>(token: string, dataType: string, filter: string, max = 4): Promise<T[]> {
  const out: T[] = [];
  let pageToken = '';
  for (let i = 0; i < max; i++) {
    const q = new URLSearchParams({ filter, pageSize: '25' });
    if (pageToken) q.set('pageToken', pageToken);
    const json = await api<{ dataPoints?: T[]; nextPageToken?: string }>(
      token,
      `/dataTypes/${dataType}/dataPoints?${q.toString()}`,
    );
    out.push(...(json.dataPoints ?? []));
    pageToken = json.nextPageToken ?? '';
    if (!pageToken) break;
  }
  return out;
}

/** 14日ずつ区切る（total-calories などは1回14日まで） */
function chunks(start: string, endExclusive: string, size: number): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let s = start;
  while (s < endExclusive) {
    const e = addDays(s, size) < endExclusive ? addDays(s, size) : endExclusive;
    out.push([s, e]);
    s = e;
  }
  return out;
}

/**
 * 直近 days 日分を同期して wearable_daily に保存する。
 * 睡眠時間は Fitbit の値で daily_logs.sleep_hours を上書きする（連携中は手入力欄なし）。
 */
export async function syncGoogleHealth(userId: string, days = 7): Promise<{ days: number }> {
  try {
    const token = await getAccessToken(userId);
    if (!token) throw new Error('未連携です');
    const today = dateInJST();
    const start = addDays(today, -(days - 1));
    const endEx = addDays(today, 1);

    const steps = new Map<string, { key: string; value: number }>();
    const kcal = new Map<string, { key: string; value: number }>();
    const dist = new Map<string, { key: string; value: number }>();
    const azm = new Map<string, { key: string; value: number }>();
    for (const [s, e] of chunks(start, endEx, 14)) {
      const [st, kc, di, az] = await Promise.all([
        dailyRollUp(token, 'steps', s, e),
        dailyRollUp(token, 'total-calories', s, e),
        dailyRollUp(token, 'distance', s, e),
        dailyRollUp(token, 'active-zone-minutes', s, e).catch(() => []),
      ]);
      rollupByDate(st, 'steps').forEach((v, k) => steps.set(k, v));
      rollupByDate(kc, 'totalCalories').forEach((v, k) => kcal.set(k, v));
      rollupByDate(di, 'distance').forEach((v, k) => dist.set(k, v));
      rollupByDate(az, 'activeZoneMinutes').forEach((v, k) => azm.set(k, v));
    }

    const [sleepPoints, exercisePoints] = await Promise.all([
      listAll(token, 'sleep', `sleep.interval.civil_end_time >= "${start}" AND sleep.interval.civil_end_time < "${endEx}"`),
      listAll(token, 'exercise', `exercise.interval.civil_start_time >= "${start}" AND exercise.interval.civil_start_time < "${endEx}"`),
    ]);
    const sleep = sleepByWakeDate(sleepPoints as never);
    const exercises = exercisesByDate(exercisePoints as never);

    // 安静時心拍・HRV（権限がない＝再連携前なら取得しない）
    const scopeRows = (await sql`
      select scopes from health_connections where user_id = ${userId}
    `) as unknown as Array<{ scopes: string }>;
    let rhr = new Map<string, number>();
    let hrv = new Map<string, number>();
    if (hasHealthMetricsScope(scopeRows[0]?.scopes)) {
      const [rhrPoints, hrvPoints] = await Promise.all([
        listAll(token, 'daily-resting-heart-rate', `daily_resting_heart_rate.date >= "${start}" AND daily_resting_heart_rate.date < "${endEx}"`),
        listAll(token, 'daily-heart-rate-variability', `daily_heart_rate_variability.date >= "${start}" AND daily_heart_rate_variability.date < "${endEx}"`),
      ]);
      rhr = restingHrByDate(rhrPoints as never);
      hrv = hrvByDate(hrvPoints as never);
    }

    let saved = 0;
    for (let d = start; d <= today; d = addDays(d, 1)) {
      const sl = sleep.get(d);
      const row: WearableDay = {
        date: d,
        steps: steps.has(d) ? Math.round(steps.get(d)!.value) : null,
        total_kcal: kcal.has(d) ? Math.round(kcal.get(d)!.value * 10) / 10 : null,
        distance_km: dist.has(d) ? Math.round(distanceToKm(dist.get(d)!.key, dist.get(d)!.value) * 100) / 100 : null,
        active_zone_minutes: azm.has(d) ? Math.round(azm.get(d)!.value) : null,
        sleep_minutes: sl?.sleep_minutes ?? null,
        sleep_start: sl?.sleep_start ?? null,
        sleep_end: sl?.sleep_end ?? null,
        deep_minutes: sl?.deep_minutes ?? null,
        rem_minutes: sl?.rem_minutes ?? null,
        light_minutes: sl?.light_minutes ?? null,
        awake_minutes: sl?.awake_minutes ?? null,
        exercises: exercises.get(d) ?? [],
      };
      const hasData =
        row.steps !== null || row.total_kcal !== null || row.sleep_minutes !== null || row.exercises.length > 0;
      if (!hasData) continue;
      await sql`
        insert into wearable_daily (
          user_id, date, steps, total_kcal, distance_km, active_zone_minutes,
          sleep_minutes, sleep_start, sleep_end, deep_minutes, rem_minutes, light_minutes, awake_minutes,
          exercises, synced_at
        ) values (
          ${userId}, ${d}, ${row.steps}, ${row.total_kcal}, ${row.distance_km}, ${row.active_zone_minutes},
          ${row.sleep_minutes}, ${row.sleep_start}, ${row.sleep_end}, ${row.deep_minutes}, ${row.rem_minutes},
          ${row.light_minutes}, ${row.awake_minutes}, ${JSON.stringify(row.exercises)}::jsonb, now()
        )
        on conflict (user_id, date) do update set
          steps = excluded.steps, total_kcal = excluded.total_kcal, distance_km = excluded.distance_km,
          active_zone_minutes = excluded.active_zone_minutes, sleep_minutes = excluded.sleep_minutes,
          sleep_start = excluded.sleep_start, sleep_end = excluded.sleep_end,
          deep_minutes = excluded.deep_minutes, rem_minutes = excluded.rem_minutes,
          light_minutes = excluded.light_minutes, awake_minutes = excluded.awake_minutes,
          exercises = excluded.exercises, synced_at = now()
      `;
      if (rhr.has(d) || hrv.has(d)) {
        await sql`
          update wearable_daily set resting_hr = ${rhr.get(d) ?? null}, hrv_ms = ${hrv.get(d) ?? null}
          where user_id = ${userId} and date = ${d}
        `;
      }
      if (row.sleep_minutes !== null) {
        const hours = Math.round((row.sleep_minutes / 60) * 2) / 2; // 0.5時間刻み（朝の記録と同じ）
        await sql`
          insert into daily_logs (user_id, date, sleep_hours)
          values (${userId}, ${d}, ${hours})
          on conflict (user_id, date) do update
            set sleep_hours = excluded.sleep_hours -- 連携中は Fitbit の値を正とする
        `;
      }
      saved++;
    }

    await sql`update health_connections set last_synced_at = now(), last_error = null where user_id = ${userId}`;
    return { days: saved };
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 300) : 'sync failed';
    await sql`update health_connections set last_error = ${msg} where user_id = ${userId}`;
    throw err;
  }
}

export async function disconnectGoogleHealth(userId: string): Promise<void> {
  const rows = (await sql`
    select refresh_token_enc from health_connections where user_id = ${userId}
  `) as unknown as Array<{ refresh_token_enc: string }>;
  if (rows[0]) {
    try {
      await fetch(REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: decryptSecret(rows[0].refresh_token_enc) }),
      });
    } catch {
      // 取り消しに失敗しても連携情報は消す
    }
  }
  await sql`delete from health_connections where user_id = ${userId}`;
}
