'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { saveDailyLogAction } from '@/app/actions/daily-log';
import { dateInJST } from '@/lib/date';
import {
  BOWEL_LABELS,
  FATIGUE_LABELS,
  QUALITY_LABELS,
  type Bowel,
  type DailyLog,
} from '@/lib/types';

interface Props {
  initial?: DailyLog | null;
}

const BOWELS: Bowel[] = ['none', 'soft', 'normal', 'firm', 'diarrhea'];

export default function DailyLogForm({ initial }: Props) {
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
  const [bowel, setBowel] = useState<Bowel | ''>(initial?.bowel ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');

  // カスタム項目
  type Custom = { key: string; value: string };
  const initialCustom: Custom[] = initial?.custom_fields
    ? Object.entries(initial.custom_fields).map(([k, v]) => ({
        key: k,
        value: String(v),
      }))
    : [];
  const [customs, setCustoms] = useState<Custom[]>(initialCustom);

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      router.refresh();
    }
  }, [state, router]);

  const setCustom = (i: number, patch: Partial<Custom>) => {
    setCustoms((arr) => arr.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };
  const addCustom = () =>
    setCustoms((arr) => [...arr, { key: '', value: '' }]);
  const removeCustom = (i: number) =>
    setCustoms((arr) => arr.filter((_, idx) => idx !== i));

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

      {/* 睡眠 */}
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

      {/* 便通 */}
      <div>
        <label className="block text-sm font-medium mb-2">便通</label>
        <input type="hidden" name="bowel" value={bowel} />
        <div className="grid grid-cols-5 gap-2">
          {BOWELS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBowel(bowel === b ? '' : b)}
              className={`h-11 rounded-xl border text-sm font-medium ${
                bowel === b
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {BOWEL_LABELS[b]}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* メモ */}
      <div>
        <label className="block text-sm font-medium mb-1">メモ（任意）</label>
        <textarea
          name="memo"
          rows={2}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="今日の体調、特記事項など"
          className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white"
        />
      </div>

      {/* カスタム項目 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">追加項目（任意）</label>
          <button
            type="button"
            onClick={addCustom}
            className="text-xs text-blue-600 hover:underline"
          >
            + 項目追加
          </button>
        </div>
        {customs.length === 0 && (
          <p className="text-xs text-gray-500">
            必要に応じて自由な項目（例：水分量、足の張り）を追加できます。
          </p>
        )}
        {customs.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2">
            <input
              type="text"
              name="custom_key"
              value={c.key}
              onChange={(e) => setCustom(i, { key: e.target.value })}
              placeholder="項目名"
              className="h-11 px-3 rounded-xl border border-gray-300 bg-white"
              maxLength={50}
            />
            <input
              type="text"
              name="custom_value"
              value={c.value}
              onChange={(e) => setCustom(i, { value: e.target.value })}
              placeholder="値"
              className="h-11 px-3 rounded-xl border border-gray-300 bg-white"
              maxLength={200}
            />
            <button
              type="button"
              onClick={() => removeCustom(i)}
              className="text-xs text-red-500 hover:text-red-700 px-2"
              aria-label="削除"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

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
