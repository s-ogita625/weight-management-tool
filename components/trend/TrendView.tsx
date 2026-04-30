'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import LineChart from '@/components/charts/LineChart';
import MarkdownLite from '@/components/ai/MarkdownLite';
import {
  addDays,
  daysBetween,
  linearRegression,
  movingAverage,
} from '@/lib/stats';
import {
  BOWEL_LABELS,
  FATIGUE_LABELS,
  QUALITY_LABELS,
  type DailyLog,
  type Profile,
} from '@/lib/types';

interface Props {
  logs: DailyLog[];
  profile: Profile | null;
}

type Range = '14d' | '30d' | '90d' | 'all';

export default function TrendView({ logs, profile }: Props) {
  const [range, setRange] = useState<Range>('30d');
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (logs.length === 0) return [];
    const last = logs[logs.length - 1].date;
    const days = range === '14d' ? 14 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
    const start = addDays(last, -days + 1);
    return logs.filter((l) => l.date >= start);
  }, [logs, range]);

  const baseDate = filtered[0]?.date ?? logs[0]?.date ?? '';

  const weightSeries = filtered
    .filter((l) => l.weight_kg !== null)
    .map((l) => ({
      x: daysBetween(baseDate, l.date),
      y: Number(l.weight_kg),
      label: l.date,
    }));

  const bodyFatSeries = filtered
    .filter((l) => l.body_fat_pct !== null)
    .map((l) => ({
      x: daysBetween(baseDate, l.date),
      y: Number(l.body_fat_pct),
      label: l.date,
    }));

  // 移動平均（7日）
  const ma7 = movingAverage(
    weightSeries.map((p) => p.y),
    7,
  );
  const weightMA7 = weightSeries.map((p, i) => ({ x: p.x, y: ma7[i] }));

  // 線形回帰（体重）
  const fit = linearRegression(weightSeries);

  // 予測ライン: 最後の点から30日先まで延長
  let predictionSeries: Array<{ x: number; y: number }> = [];
  let predicted30: number | null = null;
  let weeklyDelta: number | null = null;
  if (fit && weightSeries.length >= 3) {
    const lastX = weightSeries[weightSeries.length - 1].x;
    const futureEnd = lastX + 30;
    predictionSeries = [
      { x: weightSeries[0].x, y: fit.predict(weightSeries[0].x) },
      { x: futureEnd, y: fit.predict(futureEnd) },
    ];
    predicted30 = fit.predict(futureEnd);
    weeklyDelta = fit.slope * 7;
  }

  // 統計
  const stats = computeStats(filtered);

  // X軸ラベル: 開始/中間/終了
  const xLabels = useMemo(() => {
    if (filtered.length === 0) return [];
    const result: { x: number; label: string }[] = [];
    const baseX = 0;
    const lastDate = filtered[filtered.length - 1].date;
    const lastX = daysBetween(baseDate, lastDate);
    result.push({ x: baseX, label: shortDate(filtered[0].date) });
    if (filtered.length > 4) {
      const midIdx = Math.floor(filtered.length / 2);
      result.push({
        x: daysBetween(baseDate, filtered[midIdx].date),
        label: shortDate(filtered[midIdx].date),
      });
    }
    result.push({ x: lastX, label: shortDate(lastDate) });
    return result;
  }, [filtered, baseDate]);

  // X軸ラベル（予測グラフは未来日も含む）
  const xLabelsWithFuture = useMemo(() => {
    if (filtered.length === 0 || !fit) return xLabels;
    const lastDate = filtered[filtered.length - 1].date;
    const lastX = daysBetween(baseDate, lastDate);
    const futureDate = addDays(lastDate, 30);
    return [
      ...xLabels,
      { x: lastX + 30, label: shortDate(futureDate) + '(予測)' },
    ];
  }, [xLabels, fit, filtered, baseDate]);

  const fetchAdvice = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiAdvice(null);
    try {
      const res = await fetch('/api/advice', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setAiError(json.error ?? 'エラーが発生しました');
      } else {
        setAiAdvice(json.advice ?? '');
      }
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 期間切替 */}
      <div className="flex gap-2">
        {(['14d', '30d', '90d', 'all'] as Range[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`flex-1 h-10 rounded-xl border text-sm font-medium ${
              range === r
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white border-gray-300 text-gray-700'
            }`}
          >
            {r === '14d'
              ? '14日'
              : r === '30d'
                ? '30日'
                : r === '90d'
                  ? '90日'
                  : '全期間'}
          </button>
        ))}
      </div>

      {/* 統計サマリー */}
      <div className="grid grid-cols-2 gap-3">
        <Card label="記録日数" value={`${stats.daysLogged}日`} />
        <Card
          label="平均体重"
          value={
            stats.avgWeight !== null ? `${stats.avgWeight.toFixed(1)}kg` : '-'
          }
        />
        <Card
          label="期間中の変化"
          value={
            stats.deltaWeight !== null
              ? `${stats.deltaWeight > 0 ? '+' : ''}${stats.deltaWeight.toFixed(1)}kg`
              : '-'
          }
          color={
            stats.deltaWeight !== null && stats.deltaWeight < 0
              ? 'text-emerald-600'
              : stats.deltaWeight !== null && stats.deltaWeight > 0
                ? 'text-amber-600'
                : 'text-gray-700'
          }
        />
        <Card
          label="平均睡眠"
          value={
            stats.avgSleep !== null ? `${stats.avgSleep.toFixed(1)}h` : '-'
          }
        />
      </div>

      {/* 体重 + 移動平均 + 予測 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          体重の推移（7日移動平均・予測線つき）
        </h2>
        <LineChart
          series={[
            {
              label: '体重',
              color: '#2563eb',
              points: weightSeries,
            },
            {
              label: '7日移動平均',
              color: '#10b981',
              points: weightMA7,
              showDots: false,
            },
            ...(predictionSeries.length > 0
              ? [
                  {
                    label: '予測（線形回帰）',
                    color: '#f59e0b',
                    points: predictionSeries,
                    dashed: true,
                    showDots: false,
                  },
                ]
              : []),
          ]}
          xLabels={xLabelsWithFuture}
          yUnit="kg"
        />
      </div>

      {/* 予測サマリー */}
      {fit && predicted30 !== null && weeklyDelta !== null && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
          <div className="font-semibold text-gray-800 mb-1">📈 予測サマリー</div>
          <div className="text-gray-700 space-y-1">
            <div>
              週次変化:{' '}
              <span className="font-semibold tabular-nums">
                {weeklyDelta >= 0 ? '+' : ''}
                {weeklyDelta.toFixed(2)} kg/週
              </span>
            </div>
            <div>
              30日後の予想体重:{' '}
              <span className="font-semibold tabular-nums">
                {predicted30.toFixed(1)} kg
              </span>
            </div>
            <div>
              R²（あてはまりの良さ）:{' '}
              <span className="tabular-nums">{fit.r2.toFixed(2)}</span>{' '}
              <span className="text-xs text-gray-500">
                {fit.r2 >= 0.7
                  ? '安定したトレンド'
                  : fit.r2 >= 0.4
                    ? 'ばらつきあり'
                    : 'ばらつき大きい'}
              </span>
            </div>
            {profile?.target_weight_kg && (
              <div>
                目標体重 {Number(profile.target_weight_kg).toFixed(1)}kg まで:{' '}
                <span className="font-semibold tabular-nums">
                  {predictedDaysToGoal(
                    weightSeries[weightSeries.length - 1].y,
                    Number(profile.target_weight_kg),
                    fit.slope,
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 体脂肪 */}
      {bodyFatSeries.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            体脂肪率の推移
          </h2>
          <LineChart
            series={[
              {
                label: '体脂肪率',
                color: '#ef4444',
                points: bodyFatSeries,
              },
            ]}
            xLabels={xLabels}
            yUnit="%"
            height={180}
          />
        </div>
      )}

      {/* コンディション統計 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm font-semibold text-gray-700 mb-3">
          コンディション平均
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat
            label="睡眠の質"
            value={fmtAvg(stats.avgSleepQuality, QUALITY_LABELS)}
          />
          <Stat
            label="疲労度"
            value={fmtAvg(stats.avgFatigue, FATIGUE_LABELS)}
          />
          <Stat label="気分" value={fmtAvg(stats.avgMood, QUALITY_LABELS)} />
          <Stat
            label="便通の最頻"
            value={
              stats.modeBowel
                ? BOWEL_LABELS[stats.modeBowel as keyof typeof BOWEL_LABELS]
                : '-'
            }
          />
        </div>
      </div>

      {/* AI 見解 */}
      <div className="space-y-3">
        <button
          onClick={fetchAdvice}
          disabled={aiLoading}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl"
        >
          {aiLoading
            ? '🤖 分析中...'
            : aiAdvice
              ? '🔁 AI見解を再生成'
              : '✨ AIに今のトレンドを分析してもらう'}
        </button>
        {aiError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
            {aiError}
          </div>
        )}
        {aiAdvice && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">
              🤖 AIの見解
            </div>
            <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
              <MarkdownLite text={aiAdvice} />
            </div>
          </div>
        )}
      </div>

      <div className="text-center">
        <Link href="/morning" className="text-sm text-blue-600 underline">
          朝の記録ページへ →
        </Link>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  color = 'text-gray-900',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${color}`}>
        {value}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function shortDate(s: string): string {
  return s.slice(5).replace('-', '/');
}

function fmtAvg(
  v: number | null,
  labels: Record<number, string>,
): string {
  if (v === null) return '-';
  const rounded = Math.round(v);
  return `${v.toFixed(1)} (${labels[rounded] ?? ''})`;
}

interface ComputedStats {
  daysLogged: number;
  avgWeight: number | null;
  deltaWeight: number | null;
  avgSleep: number | null;
  avgSleepQuality: number | null;
  avgFatigue: number | null;
  avgMood: number | null;
  modeBowel: string | null;
}

function computeStats(logs: DailyLog[]): ComputedStats {
  if (logs.length === 0) {
    return {
      daysLogged: 0,
      avgWeight: null,
      deltaWeight: null,
      avgSleep: null,
      avgSleepQuality: null,
      avgFatigue: null,
      avgMood: null,
      modeBowel: null,
    };
  }

  const w = logs.filter((l) => l.weight_kg !== null).map((l) => Number(l.weight_kg));
  const s = logs.filter((l) => l.sleep_hours !== null).map((l) => Number(l.sleep_hours));
  const sq = logs.filter((l) => l.sleep_quality !== null).map((l) => Number(l.sleep_quality));
  const f = logs.filter((l) => l.fatigue !== null).map((l) => Number(l.fatigue));
  const m = logs.filter((l) => l.mood !== null).map((l) => Number(l.mood));

  const bowels = logs.filter((l) => l.bowel !== null).map((l) => l.bowel as string);
  const bowelCount: Record<string, number> = {};
  bowels.forEach((b) => (bowelCount[b] = (bowelCount[b] ?? 0) + 1));
  const modeBowel =
    bowels.length > 0
      ? Object.entries(bowelCount).sort((a, b) => b[1] - a[1])[0][0]
      : null;

  const avg = (arr: number[]): number | null =>
    arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;

  const deltaWeight =
    w.length >= 2 ? w[w.length - 1] - w[0] : null;

  return {
    daysLogged: logs.length,
    avgWeight: avg(w),
    deltaWeight,
    avgSleep: avg(s),
    avgSleepQuality: avg(sq),
    avgFatigue: avg(f),
    avgMood: avg(m),
    modeBowel,
  };
}

function predictedDaysToGoal(
  current: number,
  goal: number,
  slopePerDay: number,
): string {
  if (slopePerDay === 0) return '横ばい（停滞）';
  const days = (goal - current) / slopePerDay;
  if (days < 0) return '逆方向に進行中';
  if (days > 365 * 3) return '3年以上';
  const d = Math.round(days);
  if (d < 30) return `約 ${d} 日`;
  if (d < 365) return `約 ${Math.round(d / 30)} ヶ月`;
  return `約 ${(d / 365).toFixed(1)} 年`;
}
