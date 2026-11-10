import { Activity } from 'lucide-react';
import Link from 'next/link';
import type { Recovery } from '@/lib/fitness';
import { daysBetween } from '@/lib/stats';

const TONE = {
  good: { text: 'text-[#a3ff12]', ring: 'border-[#a3ff12]/35 bg-[#a3ff12]/10' },
  normal: { text: 'text-[#8feeff]', ring: 'border-[#20e0ff]/30 bg-[#20e0ff]/10' },
  tired: { text: 'text-amber-200', ring: 'border-amber-300/35 bg-amber-400/10' },
} as const;

/** Fitbit の心拍・HRV・睡眠から推定した今日の回復度（疲労度） */
export default function RecoveryCard({
  recovery,
  lastStrength,
  today,
  compact = false,
}: {
  recovery: Recovery | null;
  lastStrength?: string | null;
  today: string;
  compact?: boolean;
}) {
  if (!recovery) {
    if (compact) return null;
    return (
      <section className="sport-card p-4 text-xs text-slate-400">
        <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-200">
          <Activity size={16} className="text-[#a3ff12]" /> 今日の回復度
        </div>
        今朝の心拍・HRV・睡眠のデータがまだありません。
        <Link href="/settings/health" className="ml-1 underline underline-offset-2">
          連携設定
        </Link>
        で心拍・HRV の権限があるか確認してください。
      </section>
    );
  }

  const tone = TONE[recovery.tone];
  const sinceStrength = lastStrength ? daysBetween(lastStrength, today) : null;
  const advice =
    recovery.tone === 'tired'
      ? '今日は軽め（ボリュームを2〜3割減らす）か休養日に。早めに寝ましょう。'
      : recovery.tone === 'good'
        ? sinceStrength !== null && sinceStrength >= 2
          ? `前回の筋トレから${sinceStrength}日。しっかりトレーニングできる日です。`
          : 'しっかりトレーニングできる日です。'
        : 'いつも通りのメニューでOK。';

  return (
    <section className={`rounded-xl border p-4 ${tone.ring}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Activity size={16} className={tone.text} />
          今日の回復度
        </div>
        <span className="text-[10px] text-slate-400">Fitbit から推定</span>
      </div>
      <div className={`mt-1 text-xl font-black ${tone.text}`}>{recovery.label}</div>
      <div className="mt-1 text-[11px] text-slate-300">{recovery.reasons.join(' / ')}</div>
      {!compact && <p className="mt-2 text-xs text-slate-200">{advice}</p>}
    </section>
  );
}
