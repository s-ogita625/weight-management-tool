'use client';

import { Pause, Play, RotateCcw, Timer, TrendingUp, Trophy, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import LineChart from '@/components/charts/LineChart';
import { daysBetween } from '@/lib/stats';
import type {
  BodyPartBalance,
  ExerciseHistory,
  PersonalRecord,
  ProgressionSuggestion,
} from '@/lib/workout-analysis';

// ------------------------------------------------------------------
// C1 次回の重量目安
// ------------------------------------------------------------------
export function ProgressionPanel({
  suggestions,
  exerciseNames,
  onApply,
}: {
  suggestions: ProgressionSuggestion[];
  exerciseNames: string[];
  onApply: (items: ProgressionSuggestion[]) => void;
}) {
  const names = new Set(exerciseNames.map((n) => n.trim()).filter(Boolean));
  const relevant = suggestions.filter((s) => names.has(s.name) && s.action !== 'hold');
  if (relevant.length === 0) return null;
  const increases = relevant.filter((s) => s.action === 'increase');

  return (
    <div className="sport-card space-y-3 border-[#a3ff12]/30 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-black">
          <TrendingUp size={17} className="text-[#a3ff12]" />
          今日の目安（漸進性過負荷）
        </div>
        <button
          type="button"
          onClick={() => onApply(relevant)}
          className="rounded-lg bg-[#a3ff12] px-3 py-2 text-xs font-black text-[#061006] active:scale-95"
        >
          入力に反映
        </button>
      </div>
      <ul className="space-y-2">
        {relevant.map((s) => (
          <li key={s.name} className="rounded-lg bg-black/20 px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-bold text-white">{s.name}</span>
              <span className="shrink-0 tabular-nums">
                {s.action === 'increase' ? (
                  <>
                    <span className="text-slate-400">{s.currentWeight}kg →</span>{' '}
                    <b className="text-[#a3ff12]">{s.suggestedWeight}kg</b>
                    <span className="text-slate-400"> × {s.targetReps}回〜</span>
                  </>
                ) : (
                  <b className="text-[#20e0ff]">
                    {s.suggestedWeight}kg × {s.targetReps}回
                  </b>
                )}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400">
              {s.reason}
              {s.action === 'increase' && s.stagnantSessions >= 6 && (
                <span className="ml-1 text-amber-200">（同じ重量が{s.stagnantSessions}回続いています）</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {increases.length > 0 && (
        <p className="text-[11px] text-slate-500">
          上げた重量で目標回数に届かなければ、届いた回数のまま記録すればOK。次回また同じ重量で回数を伸ばします。
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// C2/C3 種目ごとの推定1RM・自己ベスト・部位バランス
// ------------------------------------------------------------------
export function StrengthPanel({
  histories,
  prs,
  balance,
}: {
  histories: ExerciseHistory[];
  prs: PersonalRecord[];
  balance: BodyPartBalance[];
}) {
  const options = histories.filter((h) => h.sessions.length >= 2);
  const [selected, setSelected] = useState(options[0]?.name ?? '');
  const history = options.find((h) => h.name === selected) ?? options[0];

  const chart = (() => {
    if (!history) return null;
    const origin = history.sessions[0].date;
    const x = (d: string) => daysBetween(origin, d);
    const step = Math.max(1, Math.ceil(history.sessions.length / 5));
    return {
      xLabels: history.sessions
        .filter((_, i) => i % step === 0 || i === history.sessions.length - 1)
        .map((s) => ({ x: x(s.date), label: s.date.slice(5).replace('-', '/') })),
      series: [
        {
          label: '推定1RM',
          color: '#a3ff12',
          showDots: true,
          points: history.sessions.map((s) => ({ x: x(s.date), y: s.bestE1rm })),
        },
        {
          label: 'トップ重量',
          color: '#20e0ff',
          dashed: true,
          points: history.sessions.map((s) => ({ x: x(s.date), y: s.topWeight })),
        },
      ],
    };
  })();

  return (
    <div className="space-y-4">
      {history && chart && (
        <div className="sport-card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-black text-white">種目ごとの伸び</h2>
            <select
              value={history.name}
              onChange={(e) => setSelected(e.target.value)}
              className="sport-input h-9 max-w-[60%] text-xs"
              aria-label="種目を選ぶ"
            >
              {options.map((h) => (
                <option key={h.name} value={h.name}>
                  {h.name}（{h.sessions.length}回）
                </option>
              ))}
            </select>
          </div>
          <LineChart height={170} yUnit="kg" xLabels={chart.xLabels} series={chart.series} />
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            <MiniStat label="自己ベスト(推定1RM)" value={`${history.bestE1rm}kg`} />
            <MiniStat label="達成日" value={history.bestE1rmDate.slice(5).replace('-', '/')} />
            <MiniStat
              label="最初→最新"
              value={`${history.sessions[0].topWeight}→${history.sessions.at(-1)?.topWeight}kg`}
            />
          </div>
        </div>
      )}

      <div className="sport-card p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-black text-white">
          <Trophy size={16} className="text-amber-300" /> 最近の自己ベスト
        </h2>
        {prs.length === 0 ? (
          <p className="text-xs text-slate-400">
            直近90日の更新はありません。「今日の目安」で重量か回数を1つずつ伸ばしていきましょう。
          </p>
        ) : (
          <ul className="space-y-1 text-xs">
            {prs.slice(0, 8).map((p) => (
              <li key={`${p.name}-${p.date}`} className="flex justify-between gap-2">
                <span className="truncate text-slate-200">{p.name}</span>
                <span className="shrink-0 tabular-nums text-slate-400">
                  {p.date.slice(5).replace('-', '/')} {p.previousBest}→
                  <b className="text-[#a3ff12]">{p.e1rm}kg</b>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sport-card p-4">
        <h2 className="mb-1 text-sm font-black text-white">部位バランス（直近4週・週あたり）</h2>
        <p className="mb-3 text-[11px] text-slate-500">
          目安：胸・背中・肩・脚は週10〜20セット、腕・腹は週6〜15セット
        </p>
        <div className="space-y-2.5">
          {balance.map((b) => {
            const color =
              b.status === 'low' ? 'bg-amber-300' : b.status === 'high' ? 'bg-rose-300' : 'bg-[#a3ff12]';
            return (
              <div key={b.bodyPart}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-bold text-slate-200">{b.label}</span>
                  <span className="tabular-nums text-slate-400">
                    {b.setsPerWeek}set/週
                    {b.status === 'low' && <span className="ml-1 text-amber-200">少なめ</span>}
                    {b.status === 'high' && <span className="ml-1 text-rose-200">多め</span>}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div
                    className={`h-2 rounded-full ${color}`}
                    style={{ width: `${Math.min(100, (b.setsPerWeek / 20) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/20 px-1 py-2">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="font-black tabular-nums">{value}</div>
    </div>
  );
}

// ------------------------------------------------------------------
// C4 休憩タイマー
// ------------------------------------------------------------------
export const REST_TIMER_EVENT = 'rest-timer:start';

export function startRestTimer() {
  window.dispatchEvent(new CustomEvent(REST_TIMER_EVENT));
}

const PRESETS = [60, 90, 120, 180];

export function RestTimer() {
  const [duration, setDuration] = useState(90);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const durationRef = useRef(duration);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    const onStart = () => {
      setPausedLeft(null);
      setEndAt(Date.now() + durationRef.current * 1000);
      setOpen(true);
    };
    window.addEventListener(REST_TIMER_EVENT, onStart);
    return () => window.removeEventListener(REST_TIMER_EVENT, onStart);
  }, []);

  useEffect(() => {
    if (endAt === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endAt) {
        setEndAt(null);
        try {
          navigator.vibrate?.([200, 100, 200]);
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          osc.frequency.value = 880;
          osc.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
        } catch {
          // 音やバイブが使えない環境は無視
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [endAt]);

  const left =
    endAt !== null ? Math.max(0, Math.ceil((endAt - now) / 1000)) : pausedLeft ?? duration;
  const running = endAt !== null;
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="floating-above-nav fixed bottom-[88px] right-4 z-40 flex h-12 items-center gap-1.5 rounded-full border border-[#a3ff12]/40 bg-[#0b1018] px-4 text-xs font-black text-[#a3ff12] shadow-2xl"
        aria-label="休憩タイマーを開く"
      >
        <Timer size={16} /> 休憩
      </button>
    );
  }

  return (
    <div className="floating-above-nav fixed inset-x-4 bottom-[88px] z-40 mx-auto max-w-md rounded-2xl border border-[#a3ff12]/40 bg-[#0b1018] p-4 shadow-2xl [@media(max-height:520px)]:p-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <Timer size={15} className="text-[#a3ff12]" /> 休憩タイマー
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="閉じる" className="text-slate-400">
          <X size={18} />
        </button>
      </div>
      <div
        className={`my-2 text-center text-5xl font-black tabular-nums [@media(max-height:520px)]:my-0 [@media(max-height:520px)]:text-3xl ${
          running ? 'text-white' : left === 0 ? 'text-[#a3ff12]' : 'text-slate-300'
        }`}
      >
        {left === 0 && !running ? 'GO!' : mmss}
      </div>
      <div className="mb-3 grid grid-cols-4 gap-2">
        {PRESETS.map((sec) => (
          <button
            key={sec}
            type="button"
            onClick={() => {
              setDuration(sec);
              setPausedLeft(null);
              setEndAt(Date.now() + sec * 1000);
            }}
            className={`h-9 rounded-lg border text-xs font-bold ${
              duration === sec ? 'border-[#a3ff12] text-[#a3ff12]' : 'border-white/10 text-slate-300'
            }`}
          >
            {sec}秒
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            if (running) {
              setPausedLeft(left);
              setEndAt(null);
            } else {
              setEndAt(Date.now() + (pausedLeft && pausedLeft > 0 ? pausedLeft : duration) * 1000);
              setPausedLeft(null);
            }
          }}
          className="sport-button-primary flex h-11 items-center justify-center gap-1"
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
          {running ? '一時停止' : 'スタート'}
        </button>
        <button
          type="button"
          onClick={() => {
            setEndAt(null);
            setPausedLeft(null);
          }}
          className="sport-button-secondary flex h-11 items-center justify-center gap-1"
        >
          <RotateCcw size={16} /> リセット
        </button>
      </div>
    </div>
  );
}
