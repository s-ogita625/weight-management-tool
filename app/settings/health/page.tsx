import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Watch } from 'lucide-react';
import HealthControls from '@/components/health/HealthControls';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import { googleHealthConfigured, hasHealthMetricsScope } from '@/lib/google-health';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  not_configured: 'サーバーに Google Health API のクライアント情報が設定されていません。',
  denied: 'Google の画面で連携がキャンセルされました。',
  state: '連携の確認に失敗しました。もう一度お試しください。',
  token: 'Google からトークンを受け取れませんでした。クライアント設定（リダイレクトURI・テストユーザー）を確認してください。',
};

export default async function HealthSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string; sync?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  const params = await searchParams;

  const [connRows, recentRows] = await Promise.all([
    sql`
      select connected_at, last_synced_at, last_error, scopes
      from health_connections where user_id = ${userId}
    `.catch(() => []),
    sql`
      select to_char(w.date, 'YYYY-MM-DD') as date, w.steps, w.total_kcal::float as total_kcal, w.sleep_minutes,
             w.resting_hr, w.hrv_ms::float as hrv_ms, l.weight_kg::float as weight_kg
      from wearable_daily w
      left join daily_logs l on l.user_id = w.user_id and l.date = w.date
      where w.user_id = ${userId}
      order by w.date desc limit 7
    `.catch(() => []),
  ]);
  const conn = (connRows as unknown as Array<{
    connected_at: string;
    last_synced_at: string | null;
    last_error: string | null;
    scopes: string;
  }>)[0];
  const recent = recentRows as unknown as Array<{
    date: string;
    steps: number | null;
    total_kcal: number | null;
    sleep_minutes: number | null;
    resting_hr: number | null;
    hrv_ms: number | null;
    weight_kg: number | null;
  }>;
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-';

  return (
    <div className="space-y-4 py-4">
      <div>
        <div className="sport-kicker">Wearable</div>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-black">
          <Watch size={22} className="text-[#a3ff12]" /> Fitbit / Google Health 連携
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Fitbit Air などで計測した歩数・消費カロリー・睡眠・運動・安静時心拍・HRV と、体組成計アプリ（eufyLife など）からヘルスケア経由で届いた体重・体脂肪率を、Google Health API から毎朝7時に自動で取り込みます。
          連携中は睡眠の入力欄がなくなり、運動は Fitbit の記録を表示し、疲労度は心拍・HRV・睡眠から推定します。
        </p>
      </div>

      {params.error && (
        <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {ERRORS[params.error] ?? '連携に失敗しました。'}
        </div>
      )}
      {params.connected && (
        <div className="rounded-lg border border-emerald-300/35 bg-emerald-400/10 p-3 text-sm text-emerald-100">
          連携しました。{params.sync === 'failed' ? '初回の同期は失敗したので「今すぐ同期」を押してください。' : '過去30日分を取り込みました。'}
        </div>
      )}

      <section className="sport-card space-y-3 p-4">
        {!googleHealthConfigured() ? (
          <p className="text-sm text-slate-300">
            サーバー側の準備（Google Cloud で Google Health API を有効化し、OAuth クライアントを作成して
            <code className="mx-1 rounded bg-black/30 px-1">GOOGLE_HEALTH_CLIENT_ID</code>と
            <code className="mx-1 rounded bg-black/30 px-1">GOOGLE_HEALTH_CLIENT_SECRET</code>
            を設定）が終わると連携できるようになります。
          </p>
        ) : conn ? (
          <>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-slate-400">連携日時</dt>
              <dd className="tabular-nums">{fmt(conn.connected_at)}</dd>
              <dt className="text-slate-400">最終同期</dt>
              <dd className="tabular-nums">{fmt(conn.last_synced_at)}</dd>
            </dl>
            {conn.last_error && (
              <p className="rounded bg-rose-500/10 p-2 text-[11px] text-rose-200">直近のエラー: {conn.last_error}</p>
            )}
            {!hasHealthMetricsScope(conn.scopes) && (
              <div className="space-y-2 rounded-lg border border-amber-300/35 bg-amber-400/10 p-3 text-xs text-amber-100">
                <p>
                  疲労度（回復度）の推定に使う「安静時心拍・HRV」の読み取り権限がまだありません。
                  もう一度連携すると追加されます（記録済みのデータはそのまま）。
                </p>
                <Link
                  href="/api/google-health/connect"
                  prefetch={false}
                  className="sport-button-primary flex h-10 items-center justify-center text-sm"
                >
                  心拍・HRV の権限を追加して再連携
                </Link>
              </div>
            )}
            <HealthControls />
          </>
        ) : (
          <>
            <p className="text-sm text-slate-300">
              Fitbit Air をつないでいる Google アカウントでログインして、歩数・消費カロリー・睡眠・運動・心拍の読み取りを許可してください（読み取りのみ）。
            </p>
            <Link
              href="/api/google-health/connect"
              prefetch={false}
              className="sport-button-primary flex h-12 items-center justify-center"
            >
              Google Health と連携する
            </Link>
          </>
        )}
      </section>

      {recent.length > 0 && (
        <section className="sport-card p-4">
          <h2 className="mb-2 text-sm font-black">同期済みデータ（直近7日）</h2>
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-[10px] text-slate-400">
                <th className="text-left font-semibold">日付</th>
                <th className="text-right font-semibold">歩数</th>
                <th className="text-right font-semibold">消費kcal</th>
                <th className="text-right font-semibold">睡眠</th>
                <th className="text-right font-semibold">安静時心拍</th>
                <th className="text-right font-semibold">HRV</th>
                <th className="text-right font-semibold">体重</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.date} className="border-t border-white/5">
                  <td className="py-1.5">{r.date.slice(5).replace('-', '/')}</td>
                  <td className="py-1.5 text-right">{r.steps?.toLocaleString() ?? '-'}</td>
                  <td className="py-1.5 text-right">{r.total_kcal ? Math.round(r.total_kcal).toLocaleString() : '-'}</td>
                  <td className="py-1.5 text-right">
                    {r.sleep_minutes ? `${Math.floor(r.sleep_minutes / 60)}h${String(r.sleep_minutes % 60).padStart(2, '0')}` : '-'}
                  </td>
                  <td className="py-1.5 text-right">{r.resting_hr ?? '-'}</td>
                  <td className="py-1.5 text-right">{r.hrv_ms ? `${Math.round(r.hrv_ms)}ms` : '-'}</td>
                  <td className="py-1.5 text-right">{r.weight_kg ? r.weight_kg.toFixed(1) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
