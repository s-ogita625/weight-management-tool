'use client';

import { useMemo, useState } from 'react';

export interface CalendarDaySummary {
  date: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  meal_count: number;
  weight_kg: number | null;
  body_fat_pct: number | null;
  sleep_hours: number | null;
  fatigue: number | null;
  mood: number | null;
}

interface Props {
  days: CalendarDaySummary[];
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function monthLabel(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export default function RecordCalendar({ days }: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const latest = days[0]?.date;
    return latest ? new Date(`${latest}T00:00:00`) : new Date();
  });
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));

  const summaryMap = useMemo(() => {
    const map = new Map<string, CalendarDaySummary>();
    for (const day of days) map.set(day.date, day);
    return map;
  }, [days]);

  const calendarDays = useMemo(() => {
    const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [currentMonth]);

  const selectedSummary = summaryMap.get(selectedDate);

  const moveMonth = (diff: number) => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + diff, 1),
    );
  };

  return (
    <div className="space-y-4">
      <div className="sport-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            className="h-9 rounded-lg border border-white/10 px-3 text-sm font-semibold"
          >
            前月
          </button>
          <div className="text-lg font-black">{monthLabel(currentMonth)}</div>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            className="h-9 rounded-lg border border-white/10 px-3 text-sm font-semibold"
          >
            次月
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">
          {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {calendarDays.map((date) => {
            const iso = toISODate(date);
            const summary = summaryMap.get(iso);
            const inMonth = date.getMonth() === currentMonth.getMonth();
            const selected = selectedDate === iso;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedDate(iso)}
                className={`min-h-20 rounded-lg border p-1 text-left transition ${
                  selected
                    ? 'border-[#a3ff12]/80 bg-[#a3ff12]/15'
                    : summary
                      ? 'border-[#20e0ff]/30 bg-[#20e0ff]/10'
                      : 'border-white/10 bg-black/20'
                } ${inMonth ? 'opacity-100' : 'opacity-35'}`}
              >
                <div className="text-xs font-semibold tabular-nums">
                  {date.getDate()}
                </div>
                {summary ? (
                  <div className="mt-1 space-y-0.5">
                    {summary.meal_count > 0 && (
                      <div className="truncate text-[10px] font-bold text-white">
                        {Math.round(Number(summary.calories))}kcal
                      </div>
                    )}
                    {summary.weight_kg !== null && (
                      <div className="truncate text-[10px] text-[#a3ff12]">
                        {Number(summary.weight_kg).toFixed(1)}kg
                      </div>
                    )}
                    {summary.body_fat_pct !== null && (
                      <div className="truncate text-[10px] text-slate-300">
                        {Number(summary.body_fat_pct).toFixed(1)}%
                      </div>
                    )}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sport-card p-4">
        <div className="mb-2 text-sm font-bold">{selectedDate} の記録</div>
        {selectedSummary ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="食事回数" value={`${selectedSummary.meal_count}件`} />
            <Metric
              label="カロリー"
              value={`${Math.round(Number(selectedSummary.calories)).toLocaleString()}kcal`}
            />
            <Metric label="P" value={`${Math.round(Number(selectedSummary.protein_g))}g`} />
            <Metric label="F/C" value={`${Math.round(Number(selectedSummary.fat_g))}g / ${Math.round(Number(selectedSummary.carbs_g))}g`} />
            <Metric
              label="体重/体脂肪"
              value={
                selectedSummary.weight_kg !== null
                  ? `${Number(selectedSummary.weight_kg).toFixed(1)}kg / ${
                      selectedSummary.body_fat_pct === null
                        ? '-'
                        : `${Number(selectedSummary.body_fat_pct).toFixed(1)}%`
                    }`
                  : '未記録'
              }
            />
            <Metric
              label="コンディション"
              value={
                selectedSummary.sleep_hours !== null
                  ? `睡眠${Number(selectedSummary.sleep_hours).toFixed(1)}h`
                  : selectedSummary.fatigue !== null || selectedSummary.mood !== null
                    ? `疲労${selectedSummary.fatigue ?? '-'} / 気分${selectedSummary.mood ?? '-'}`
                    : '未記録'
              }
            />
          </div>
        ) : (
          <p className="text-sm text-slate-400">この日の記録はまだありません。</p>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 font-bold tabular-nums">{value}</div>
    </div>
  );
}
