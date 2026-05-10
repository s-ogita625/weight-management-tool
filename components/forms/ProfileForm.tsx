'use client';

import { useActionState, useState } from 'react';
import { saveProfileAction } from '@/app/actions/profile';
import {
  GENDER_LABELS,
  PERIOD_LABELS,
  PRIORITY_LABELS,
  TRAINING_FREQ_LABELS,
  type Gender,
  type Period,
  type Priority,
  type Profile,
  type TrainingFreq,
} from '@/lib/types';

interface Props {
  initial?: Profile | null;
}

export default function ProfileForm({ initial }: Props) {
  const [state, formAction, pending] = useActionState(saveProfileAction, null);

  const [age, setAge] = useState<number>(initial ? Number(initial.age) : 30);
  const [gender, setGender] = useState<Gender>(initial?.gender ?? 'male');
  const [heightCm, setHeightCm] = useState<number>(
    initial ? Number(initial.height_cm) : 170,
  );
  const [weightKg, setWeightKg] = useState<number>(
    initial ? Number(initial.current_weight_kg) : 65,
  );
  const [bodyFatPct, setBodyFatPct] = useState<number>(
    initial ? Number(initial.body_fat_pct) : 20,
  );
  const [trainingFreq, setTrainingFreq] = useState<TrainingFreq>(
    initial?.training_freq ?? '1-2',
  );
  const [targetWeightKg, setTargetWeightKg] = useState<number>(
    initial ? Number(initial.target_weight_kg) : 60,
  );
  const [targetBodyFatPct, setTargetBodyFatPct] = useState<number>(
    initial ? Number(initial.target_body_fat_pct) : 15,
  );
  const [period, setPeriod] = useState<Period>(initial?.target_period ?? '3mo');
  const [leanCutMode, setLeanCutMode] = useState<boolean>(
    initial?.lean_cut_mode ?? false,
  );
  const [priority, setPriority] = useState<Priority>(
    initial?.priority ?? 'fat_loss',
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="gender" value={gender} />
      <input type="hidden" name="training_freq" value={trainingFreq} />
      <input type="hidden" name="target_period" value={period} />
      <input
        type="hidden"
        name="lean_cut_mode"
        value={leanCutMode ? 'on' : 'off'}
      />
      <input type="hidden" name="priority" value={priority} />

      {/* 性別 */}
      <div>
        <label className="block text-sm font-medium mb-2">性別</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(GENDER_LABELS) as Gender[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={`h-12 rounded-xl border font-medium ${
                gender === g
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {GENDER_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      <NumberField
        label="年齢"
        name="age"
        value={age}
        onChange={setAge}
        min={10}
        max={100}
        suffix="歳"
      />
      <NumberField
        label="身長"
        name="height_cm"
        value={heightCm}
        onChange={setHeightCm}
        min={100}
        max={250}
        step={0.1}
        suffix="cm"
      />
      <NumberField
        label="現在の体重"
        name="current_weight_kg"
        value={weightKg}
        onChange={setWeightKg}
        min={30}
        max={300}
        step={0.1}
        suffix="kg"
      />
      <NumberField
        label="現在の体脂肪率"
        name="body_fat_pct"
        value={bodyFatPct}
        onChange={setBodyFatPct}
        min={3}
        max={60}
        step={0.1}
        suffix="%"
      />

      {/* 筋トレ頻度 */}
      <div>
        <label className="block text-sm font-medium mb-2">筋トレ頻度</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(TRAINING_FREQ_LABELS) as TrainingFreq[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setTrainingFreq(f)}
              className={`h-12 rounded-xl border text-sm font-medium ${
                trainingFreq === f
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {TRAINING_FREQ_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-gray-200" />

      <NumberField
        label="目標体重"
        name="target_weight_kg"
        value={targetWeightKg}
        onChange={setTargetWeightKg}
        min={30}
        max={300}
        step={0.1}
        suffix="kg"
      />
      <NumberField
        label="目標体脂肪率"
        name="target_body_fat_pct"
        value={targetBodyFatPct}
        onChange={setTargetBodyFatPct}
        min={3}
        max={60}
        step={0.1}
        suffix="%"
      />

      <div>
        <label className="block text-sm font-medium mb-2">達成期間</label>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`h-12 rounded-xl border text-sm font-medium ${
                period === p
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* リーンカット モード */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900">
              💪 リーンカットモード
            </div>
            <div className="text-xs text-gray-600 mt-1 leading-relaxed">
              筋肉を維持しながら体脂肪を落とす設定。タンパク質を高め (2.4g/kg
              LBM)、減量ペースを 0.5-0.75%/週 に抑制。
              <br />
              <span className="text-gray-500">
                根拠: ISSN Position Stand (Aragon 2017), Helms 2014
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLeanCutMode(!leanCutMode)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              leanCutMode ? 'bg-blue-600' : 'bg-gray-300'
            }`}
            aria-pressed={leanCutMode}
            aria-label="リーンカットモード切替"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                leanCutMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 優先度 */}
      <div>
        <label className="block text-sm font-medium mb-2">
          優先度
          <span className="text-gray-500 ml-1 text-xs">
            (体組成変化の重視ポイント)
          </span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={`h-12 rounded-xl border text-xs font-medium leading-tight px-1 ${
                priority === p
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          リコンプ（同時達成）はトレーニング初心者・肥満者・休止期復帰者に最も適しています。
        </p>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl"
      >
        {pending ? '保存中...' : '保存して食事プランを見る'}
      </button>
    </form>
  );
}

function NumberField({
  label,
  name,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}
        {suffix && <span className="text-gray-500 ml-1">({suffix})</span>}
      </label>
      <input
        type="number"
        name={name}
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white text-lg"
      />
    </div>
  );
}
