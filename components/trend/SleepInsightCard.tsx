import { Moon } from 'lucide-react';
import type { SleepAnalysis } from '@/lib/insights';

/** 睡眠時間と、翌日の体重変化・気分・疲労の関係 */
export default function SleepInsightCard({ analysis }: { analysis: SleepAnalysis }) {
  if (analysis.days < 10) return null;
  const fmt = (v: number | null, digits = 1, sign = false) =>
    v === null ? '-' : `${sign && v > 0 ? '+' : ''}${v.toFixed(digits)}`;
  const rows: Array<[string, string, string]> = [
    [
      '翌日の体重変化',
      `${fmt(analysis.nextDayWeightChangeShort, 2, true)}kg`,
      `${fmt(analysis.nextDayWeightChangeNormal, 2, true)}kg`,
    ],
    ['気分（5が最高）', fmt(analysis.moodShort), fmt(analysis.moodNormal)],
    ['疲労（5がとても疲れ）', fmt(analysis.fatigueShort), fmt(analysis.fatigueNormal)],
  ];

  return (
    <section className="sport-card p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-black text-white">
        <Moon size={16} className="text-[#20e0ff]" /> 睡眠と体重・体調の関係
      </h2>
      <p className="mb-3 text-[11px] text-slate-500">
        睡眠を記録した{analysis.days}日のうち、6時間未満は{analysis.shortSleepDays}日
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] text-slate-400">
            <th className="pb-1 text-left font-semibold" />
            <th className="pb-1 text-right font-semibold">6時間未満</th>
            <th className="pb-1 text-right font-semibold">6時間以上</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map(([label, a, b]) => (
            <tr key={label} className="border-t border-white/5">
              <td className="py-1.5 text-slate-300">{label}</td>
              <td className="py-1.5 text-right font-bold text-amber-200">{a}</td>
              <td className="py-1.5 text-right font-bold text-slate-100">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {analysis.messages.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-300">
          {analysis.messages.map((m) => (
            <li key={m} className="flex gap-1.5">
              <span className="text-[#a3ff12]">›</span>
              {m}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-slate-500">
        3日分以上ある項目だけ平均を出しています。相関であって因果ではありません。
      </p>
    </section>
  );
}
