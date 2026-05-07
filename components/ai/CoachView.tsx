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

interface WeeklyReportResponse {
  report: string;
  stats: AdviceResponse['stats'];
  target: AdviceResponse['target'];
  weightTrend: {
    daysLogged: number;
    deltaKg: number;
    weeklyDeltaKg: number;
    predicted30dKg: number | null;
    r2: number;
  } | null;
}

type Tab = 'advice' | 'weekly';

export default function CoachView() {
  const [tab, setTab] = useState<Tab>('advice');

  const [advice, setAdvice] = useState<AdviceResponse | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);

  const [weekly, setWeekly] = useState<WeeklyReportResponse | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);

  const generateAdvice = async () => {
    setAdviceLoading(true);
    setAdviceError(null);
    setAdvice(null);
    try {
      const res = await fetch('/api/advice', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setAdviceError(json.error ?? 'エラーが発生しました');
      } else {
        setAdvice(json);
      }
    } catch (e: unknown) {
      setAdviceError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdviceLoading(false);
    }
  };

  const generateWeekly = async () => {
    setWeeklyLoading(true);
    setWeeklyError(null);
    setWeekly(null);
    try {
      const res = await fetch('/api/weekly-report', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setWeeklyError(json.error ?? 'エラーが発生しました');
      } else {
        setWeekly(json);
      }
    } catch (e: unknown) {
      setWeeklyError(e instanceof Error ? e.message : String(e));
    } finally {
      setWeeklyLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* タブ切替 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setTab('advice')}
          className={`h-11 rounded-xl border text-sm font-medium ${
            tab === 'advice'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white border-gray-300 text-gray-700'
          }`}
        >
          💡 デイリーアドバイス
        </button>
        <button
          onClick={() => setTab('weekly')}
          className={`h-11 rounded-xl border text-sm font-medium ${
            tab === 'weekly'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white border-gray-300 text-gray-700'
          }`}
        >
          📊 週次レポート
        </button>
      </div>

      {tab === 'advice' && (
        <>
          {advice && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  📊 直近14日の記録サマリー
                </h2>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat
                    label="記録日数"
                    value={`${advice.stats.daysLogged}日`}
                  />
                  <Stat
                    label="連続記録"
                    value={`${advice.stats.consecutiveDaysLogged}日`}
                  />
                  <Stat
                    label="平均カロリー"
                    value={`${advice.stats.avgDailyCalories.toLocaleString()}kcal`}
                  />
                  <Stat
                    label="平均タンパク質"
                    value={`${advice.stats.avgDailyProtein}g`}
                  />
                  {advice.stats.daysLogged > 0 && advice.target && (
                    <>
                      <Stat
                        label="カロリー達成率"
                        value={`${advice.stats.caloriesAdherencePct}%`}
                        color={getAdherenceColor(
                          advice.stats.caloriesAdherencePct,
                        )}
                      />
                      <Stat
                        label="タンパク質達成率"
                        value={`${advice.stats.proteinAdherencePct}%`}
                        color={getAdherenceColor(
                          advice.stats.proteinAdherencePct,
                        )}
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
                  <MarkdownLite text={advice.advice} />
                </div>
              </div>
            </>
          )}

          {adviceError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
              {adviceError}
            </div>
          )}

          <button
            onClick={generateAdvice}
            disabled={adviceLoading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl"
          >
            {adviceLoading
              ? '🤖 アドバイス生成中...'
              : advice
                ? '🔁 再生成'
                : '✨ AIアドバイスを生成'}
          </button>

          {!advice && !adviceLoading && !adviceError && (
            <p className="text-xs text-gray-500 leading-relaxed">
              ボタンを押すと、過去14日のあなたの記録を参考にClaude AIが個別のアドバイスを生成します。
            </p>
          )}
        </>
      )}

      {tab === 'weekly' && (
        <>
          {weekly && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  📅 直近7日のサマリー
                </h2>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat
                    label="記録日数"
                    value={`${weekly.stats.daysLogged}日`}
                  />
                  <Stat
                    label="平均カロリー"
                    value={`${weekly.stats.avgDailyCalories.toLocaleString()}kcal`}
                  />
                  {weekly.weightTrend && weekly.weightTrend.daysLogged >= 2 && (
                    <>
                      <Stat
                        label="体重変化"
                        value={`${
                          weekly.weightTrend.deltaKg >= 0 ? '+' : ''
                        }${weekly.weightTrend.deltaKg.toFixed(1)}kg`}
                        color={
                          weekly.weightTrend.deltaKg < 0
                            ? 'text-emerald-600'
                            : weekly.weightTrend.deltaKg > 0
                              ? 'text-amber-600'
                              : 'text-gray-700'
                        }
                      />
                      <Stat
                        label="週次変化(回帰)"
                        value={`${
                          weekly.weightTrend.weeklyDeltaKg >= 0 ? '+' : ''
                        }${weekly.weightTrend.weeklyDeltaKg.toFixed(2)}kg/週`}
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="text-sm font-semibold text-gray-700 mb-3">
                  📊 週次レポート
                </div>
                <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                  <MarkdownLite text={weekly.report} />
                </div>
              </div>
            </>
          )}

          {weeklyError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
              {weeklyError}
            </div>
          )}

          <button
            onClick={generateWeekly}
            disabled={weeklyLoading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl"
          >
            {weeklyLoading
              ? '🤖 レポート生成中...'
              : weekly
                ? '🔁 再生成'
                : '📊 今週のレポートを生成'}
          </button>

          {!weekly && !weeklyLoading && !weeklyError && (
            <p className="text-xs text-gray-500 leading-relaxed">
              直近7日間の食事・体重・コンディションを総合的に振り返り、
              よかった点・課題・来週のアクションをまとめたレポートを生成します。
            </p>
          )}
        </>
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
