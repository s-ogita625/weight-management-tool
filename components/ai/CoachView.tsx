'use client';

import { useState } from 'react';
import MarkdownLite from '@/components/ai/MarkdownLite';

interface AdviceResponse {
  advice: string;
  stats: {
    totalLogs: number;
    daysLogged: number;
    avgDailyCalories: number;
    avgDailyProtein: number;
    consecutiveDaysLogged: number;
    caloriesAdherencePct: number;
    proteinAdherencePct: number;
  };
  target: {
    calories: number;
    protein_g: number;
  } | null;
}

export default function CoachView() {
  const [data, setData] = useState<AdviceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch('/api/advice', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'エラーが発生しました');
      } else {
        setData(json);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {data && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              📊 直近14日の記録サマリー
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="記録日数" value={`${data.stats.daysLogged}日`} />
              <Stat
                label="連続記録"
                value={`${data.stats.consecutiveDaysLogged}日`}
              />
              <Stat
                label="平均カロリー"
                value={`${data.stats.avgDailyCalories.toLocaleString()}kcal`}
              />
              <Stat
                label="平均タンパク質"
                value={`${data.stats.avgDailyProtein}g`}
              />
              {data.stats.daysLogged > 0 && data.target && (
                <>
                  <Stat
                    label="カロリー達成率"
                    value={`${data.stats.caloriesAdherencePct}%`}
                    color={getAdherenceColor(data.stats.caloriesAdherencePct)}
                  />
                  <Stat
                    label="タンパク質達成率"
                    value={`${data.stats.proteinAdherencePct}%`}
                    color={getAdherenceColor(data.stats.proteinAdherencePct)}
                  />
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              🤖 AIからのアドバイス
            </div>
            <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
              <MarkdownLite text={data.advice} />
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={generate}
        disabled={loading}
        className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl"
      >
        {loading
          ? '🤖 アドバイス生成中...'
          : data
            ? '🔁 再生成'
            : '✨ AIアドバイスを生成'}
      </button>

      {!data && !loading && !error && (
        <p className="text-xs text-gray-500 leading-relaxed">
          ボタンを押すと、あなたのプロフィールと食事記録を参考にClaude AIが個別のアドバイスを生成します。記録が増えるほど精度が上がります。
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`font-semibold tabular-nums ${color ?? 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}

function getAdherenceColor(pct: number): string {
  if (pct >= 90 && pct <= 110) return 'text-emerald-600';
  if (pct >= 70 && pct <= 130) return 'text-amber-600';
  return 'text-red-600';
}
