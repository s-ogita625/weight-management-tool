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

interface TimingResponse {
  analysis: {
    intervalsHours: number[];
    proteinPerMeal: number[];
    leucineThresholdMet: number;
    totalMeals: number;
    distribution: 'even' | 'front-loaded' | 'back-loaded' | 'unknown';
    longestGapHours: number;
    notes: string[];
  };
  advice: {
    perMealProteinTargetG: number;
    recommendedMealCount: number;
    preWorkout: { hoursBefore: number; carbsG: number; proteinG: number };
    postWorkout: { hoursAfter: number; proteinG: number; carbsG: number };
    notes: string[];
    alerts: string[];
  };
  nextMeal: {
    etaMinutes: number;
    type: string;
    protein_g: number;
    suggestion: string;
  } | null;
  plan: {
    targetCalories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    goal: 'cut' | 'bulk' | 'maintain';
  };
  aiMessage: string;
  todayMealsCount: number;
}

type Tab = 'advice' | 'weekly' | 'timing';

export default function CoachView() {
  const [tab, setTab] = useState<Tab>('advice');

  const [advice, setAdvice] = useState<AdviceResponse | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);

  const [weekly, setWeekly] = useState<WeeklyReportResponse | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);

  const [timing, setTiming] = useState<TimingResponse | null>(null);
  const [timingLoading, setTimingLoading] = useState(false);
  const [timingError, setTimingError] = useState<string | null>(null);

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

  const generateTiming = async () => {
    setTimingLoading(true);
    setTimingError(null);
    setTiming(null);
    try {
      const res = await fetch('/api/timing-advice', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setTimingError(json.error ?? 'エラーが発生しました');
      } else {
        setTiming(json);
      }
    } catch (e: unknown) {
      setTimingError(e instanceof Error ? e.message : String(e));
    } finally {
      setTimingLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* タブ切替 */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setTab('advice')}
          className={`h-11 rounded-xl border text-xs font-medium leading-tight ${
            tab === 'advice'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white border-gray-300 text-gray-700'
          }`}
        >
          💡 デイリー
        </button>
        <button
          onClick={() => setTab('weekly')}
          className={`h-11 rounded-xl border text-xs font-medium leading-tight ${
            tab === 'weekly'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white border-gray-300 text-gray-700'
          }`}
        >
          📊 週次レポート
        </button>
        <button
          onClick={() => setTab('timing')}
          className={`h-11 rounded-xl border text-xs font-medium leading-tight ${
            tab === 'timing'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white border-gray-300 text-gray-700'
          }`}
        >
          ⏱️ タイミング
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
                <div className="text-sm text-gray-800 leading-relaxed break-words overflow-hidden">
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
                <div className="text-sm text-gray-800 leading-relaxed break-words overflow-hidden">
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

      {tab === 'timing' && (
        <>
          {timing && (
            <>
              {/* 本日の食事タイムライン */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  ⏱️ 本日のタイムライン
                </h2>
                <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                  <Stat
                    label="記録食事数"
                    value={`${timing.analysis.totalMeals}食`}
                  />
                  <Stat
                    label="leucine達成"
                    value={`${timing.analysis.leucineThresholdMet}/${timing.analysis.totalMeals}`}
                    color={
                      timing.analysis.leucineThresholdMet >=
                      Math.ceil(timing.analysis.totalMeals / 2)
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }
                  />
                  <Stat
                    label="最大食間隔"
                    value={`${timing.analysis.longestGapHours.toFixed(1)}h`}
                    color={
                      timing.analysis.longestGapHours >= 5
                        ? 'text-amber-600'
                        : 'text-gray-700'
                    }
                  />
                </div>
                {timing.analysis.notes.length > 0 && (
                  <ul className="text-xs text-gray-600 space-y-1 mt-2 list-disc list-inside">
                    {timing.analysis.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 次の食事推奨 */}
              {timing.nextMeal && (
                <div className="bg-blue-600 text-white rounded-xl p-5 shadow-sm">
                  <div className="text-xs opacity-80">次の食事の推奨</div>
                  <div className="text-2xl font-bold mt-1">
                    {timing.nextMeal.etaMinutes === 0
                      ? '今すぐ'
                      : `約 ${timing.nextMeal.etaMinutes} 分後`}
                  </div>
                  <div className="text-sm opacity-90 mt-1">
                    タイプ: {timing.nextMeal.type} / タンパク質目安:{' '}
                    {timing.nextMeal.protein_g}g
                  </div>
                  <div className="text-sm opacity-90 mt-2">
                    {timing.nextMeal.suggestion}
                  </div>
                </div>
              )}

              {/* 推奨ガイド */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  📋 タイミング推奨
                </h2>
                <div className="text-xs space-y-2">
                  <div>
                    <span className="text-gray-500">1食あたりP目安: </span>
                    <span className="font-semibold tabular-nums">
                      {timing.advice.perMealProteinTargetG}g
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">推奨食事数: </span>
                    <span className="font-semibold tabular-nums">
                      {timing.advice.recommendedMealCount}食
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded p-2 mt-2">
                    <div className="font-semibold text-gray-700 mb-1">
                      💪 運動前 ({timing.advice.preWorkout.hoursBefore}h前)
                    </div>
                    <div className="text-gray-600">
                      炭水化物 {timing.advice.preWorkout.carbsG}g + タンパク質{' '}
                      {timing.advice.preWorkout.proteinG}g
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="font-semibold text-gray-700 mb-1">
                      🏋️ 運動後 ({timing.advice.postWorkout.hoursAfter}h以内)
                    </div>
                    <div className="text-gray-600">
                      タンパク質 {timing.advice.postWorkout.proteinG}g + 炭水化物{' '}
                      {timing.advice.postWorkout.carbsG}g
                    </div>
                  </div>
                  <ul className="text-xs text-gray-600 space-y-1 mt-2 list-disc list-inside">
                    {timing.advice.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                  {timing.advice.alerts.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                      <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                        {timing.advice.alerts.map((n, i) => (
                          <li key={i}>{n}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* AI コメント */}
              {timing.aiMessage && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="text-sm font-semibold text-gray-700 mb-3">
                    🤖 AI コーチング
                  </div>
                  <div className="text-sm text-gray-800 leading-relaxed break-words overflow-hidden">
                    <MarkdownLite text={timing.aiMessage} />
                  </div>
                </div>
              )}
            </>
          )}

          {timingError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
              {timingError}
            </div>
          )}

          <button
            onClick={generateTiming}
            disabled={timingLoading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl"
          >
            {timingLoading
              ? '🤖 分析中...'
              : timing
                ? '🔁 再分析'
                : '⏱️ 今のタイミングを分析'}
          </button>

          {!timing && !timingLoading && !timingError && (
            <p className="text-xs text-gray-500 leading-relaxed">
              本日の食事タイミングを分析し、leucine threshold (20g/食)
              の達成度や次の食事の推奨を提示します。記録は事前に「食事」タブから入力してください。
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
