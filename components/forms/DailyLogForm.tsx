'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { saveDailyLogAction } from '@/app/actions/daily-log';
import { dateInJST } from '@/lib/date';
import {
  FATIGUE_LABELS,
  QUALITY_LABELS,
  type DailyLog,
} from '@/lib/types';

interface Props {
  initial?: DailyLog | null;
  /** 直近の体調記録（「前回と同じ」ボタン用） */
  previous?: Pick<
    DailyLog,
    'date' | 'sleep_hours' | 'sleep_quality' | 'fatigue' | 'mood' | 'bowel'
  > | null;
  /** Fitbit（Google Health）と連携中なら、睡眠は自動取得なので入力欄を出さない */
  fitbitSleep?: {
    connected: boolean;
    minutes: number | null;
    deep: number | null;
    rem: number | null;
  } | null;
}


export default function DailyLogForm({ initial, previous, fitbitSleep }: Props) {
  const sleepFromFitbit = Boolean(fitbitSleep?.connected);
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveDailyLogAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  const [date, setDate] = useState(initial?.date ?? dateInJST());
  const [weight, setWeight] = useState(
    initial?.weight_kg !== null && initial?.weight_kg !== undefined
      ? String(initial.weight_kg)
      : '',
  );
  const [bodyFat, setBodyFat] = useState(
    initial?.body_fat_pct !== null && initial?.body_fat_pct !== undefined
      ? String(initial.body_fat_pct)
      : '',
  );
  const [sleepHours, setSleepHours] = useState(
    initial?.sleep_hours !== null && initial?.sleep_hours !== undefined
      ? String(initial.sleep_hours)
      : '',
  );
  const [sleepQuality, setSleepQuality] = useState<number | null>(
    initial?.sleep_quality ?? null,
  );
  const [fatigue, setFatigue] = useState<number | null>(initial?.fatigue ?? null);
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      router.refresh();
    }
  }, [state, router]);


  return (
    <form action={formAction} ref={formRef} className="space-y-5">
      {/* 日付 */}
      <div>
        <label className="block text-sm font-medium mb-1">日付</label>
        <input
          type="date"
          name="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full h-12 px-3 rounded-xl border border-gray-300 bg-white"
        />
      </div>

      {/* 体重・体脂肪 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">
            体重 <span className="text-gray-500">(kg)</span>
          </label>
          <input
            type="number"
            name="weight_kg"
            inputMode="decimal"
            step={0.1}
            min={30}
            max={300}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="例: 65.4"
            className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white text-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            体脂肪率 <span className="text-gray-500">(%)</span>
          </label>
          <input
            type="number"
            name="body_fat_pct"
            inputMode="decimal"
            step={0.1}
            min={3}
            max={60}
            value={bodyFat}
            onChange={(e) => setBodyFat(e.target.value)}
            placeholder="例: 18.5"
            className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white text-lg"
          />
        </div>
      </div>

      <hr className="border-gray-200" />

      {previous && (
        <button
          type="button"
          onClick={() => {
            if (!sleepFromFitbit) {
              if (previous.sleep_hours !== null) setSleepHours(String(previous.sleep_hours));
              setSleepQuality(previous.sleep_quality ?? null);
            }
            setFatigue(previous.fatigue ?? null);
            setMood(previous.mood ?? null);
          }}
          className="w-full h-11 rounded-xl border border-[#a3ff12]/40 bg-[#a3ff12]/10 text-sm font-semibold text-[#a3ff12]"
        >
          体調はいつも通り（{previous.date} の内容をコピー）
        </button>
      )}

      {/* 睡眠（Fitbit 連携中は自動取得） */}
      {sleepFromFitbit ? (
        <div className="rounded-xl border border-[#20e0ff]/30 bg-[#20e0ff]/10 px-4 py-3 text-sm">
          <div className="font-semibold text-[#8feeff]">睡眠は Fitbit から自動で記録されます</div>
          <div className="mt-1 text-xs text-slate-300">
            {fitbitSleep?.minutes
              ? `昨夜: ${Math.floor(fitbitSleep.minutes / 60)}時間${String(fitbitSleep.minutes % 60).padStart(2, '0')}分` +
                (fitbitSleep.deep !== null ? ` / 深い睡眠 ${fitbitSleep.deep}分` : '') +
                (fitbitSleep.rem !== null ? ` / レム ${fitbitSleep.rem}分` : '')
              : 'まだ今朝のデータが同期されていません（毎朝7時とホームを開いたときに同期）'}
          </div>
        </div>
      ) : (
      <>
      <div>
        <label className="block text-sm font-medium mb-1">
          睡眠時間 <span className="text-gray-500">(時間)</span>
        </label>
        <input
          type="number"
          name="sleep_hours"
          inputMode="decimal"
          step={0.5}
          min={0}
          max={24}
          value={sleepHours}
          onChange={(e) => setSleepHours(e.target.value)}
          placeholder="例: 7.5"
          className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white text-lg"
        />
      </div>

      <SegmentField
        label="睡眠の質"
        name="sleep_quality"
        value={sleepQuality}
        onChange={setSleepQuality}
        labels={QUALITY_LABELS}
      />
      </>
      )}
      <SegmentField
        label="疲労度"
        name="fatigue"
        value={fatigue}
        onChange={setFatigue}
        labels={FATIGUE_LABELS}
      />
      <SegmentField
        label="気分"
        name="mood"
        value={mood}
        onChange={setMood}
        labels={QUALITY_LABELS}
      />

      {state && 'error' in state && state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state && 'ok' in state && state.ok && (
        <p className="text-sm text-green-700">保存しました ✓</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl"
      >
        {pending ? '保存中...' : '保存'}
      </button>
    </form>
  );
}

function SegmentField({
  label,
  name,
  value,
  onChange,
  labels,
}: {
  label: string;
  name: string;
  value: number | null;
  onChange: (v: number | null) => void;
  labels: Record<number, string>;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <input type="hidden" name={name} value={value ?? ''} />
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            className={`h-11 rounded-xl border text-xs font-medium leading-tight px-1 ${
              value === n
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white border-gray-300 text-gray-700'
            }`}
          >
            <div>{n}</div>
            <div className="text-[9px] opacity-80">{labels[n]}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
