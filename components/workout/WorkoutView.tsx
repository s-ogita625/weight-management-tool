'use client';

import {
  Activity,
  BarChart3,
  Clock,
  Copy,
  Dumbbell,
  Flame,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';
import {
  addWorkoutSessionAction,
  deleteWorkoutSessionAction,
  saveWorkoutRoutineAction,
} from '@/app/actions/workout';
import { dateInJST, timeInJST } from '@/lib/date';
import {
  BODY_PART_ICONS,
  BODY_PART_LABELS,
  WORKOUT_SET_TYPE_LABELS,
  WORKOUT_SIDE_LABELS,
  type BodyPart,
  type WorkoutSessionDetail,
  type WorkoutSetType,
  type WorkoutSide,
  type WorkoutStats,
} from '@/lib/types';

type Tab = 'record' | 'history' | 'analysis';

type SetInput = {
  weight_kg: string;
  reps: string;
  rpe: string;
  rir: string;
  set_type: WorkoutSetType;
  side: WorkoutSide;
  memo: string;
};

type ExerciseInput = {
  name: string;
  body_part: BodyPart;
  memo: string;
  sets: SetInput[];
};

type WorkoutTemplate = {
  key: string;
  label: string;
  session: WorkoutSessionDetail;
};

interface Props {
  sessions: WorkoutSessionDetail[];
  stats: WorkoutStats;
}

const BODY_PARTS = Object.keys(BODY_PART_LABELS) as BodyPart[];
const SET_TYPES = Object.keys(WORKOUT_SET_TYPE_LABELS) as WorkoutSetType[];
const SIDES = Object.keys(WORKOUT_SIDE_LABELS) as WorkoutSide[];
const SPLIT_ORDER: BodyPart[] = [
  'chest',
  'triceps',
  'back',
  'arms',
  'shoulders',
  'legs',
  'core',
  'cardio',
  'full_body',
  'other',
];

const DEFAULT_EXERCISE: ExerciseInput = {
  name: '',
  body_part: 'chest',
  memo: '',
  sets: [
    {
      weight_kg: '',
      reps: '',
      rpe: '',
      rir: '',
      set_type: 'working',
      side: 'both',
      memo: '',
    },
  ],
};

export default function WorkoutView({ sessions, stats }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('record');
  const [state, formAction, pending] = useActionState(
    addWorkoutSessionAction,
    null,
  );
  const [routineState, routineAction, routinePending] = useActionState(
    saveWorkoutRoutineAction,
    null,
  );
  const [date, setDate] = useState(dateInJST());
  const [startTime, setStartTime] = useState(timeInJST());
  const [durationMin, setDurationMin] = useState('');
  const [mainBodyPart, setMainBodyPart] = useState<BodyPart>('chest');
  const [effort, setEffort] = useState('7');
  const [memo, setMemo] = useState('');
  const [routineName, setRoutineName] = useState('');
  const [exercises, setExercises] = useState<ExerciseInput[]>([
    structuredClone(DEFAULT_EXERCISE),
  ]);

  const frequent = stats.frequentExercises;
  const templates = useMemo(() => buildSplitTemplates(sessions), [sessions]);

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    if (routineState && 'ok' in routineState && routineState.ok) {
      router.refresh();
    }
  }, [routineState, router]);

  const payload = useMemo(
    () =>
      JSON.stringify({
        exercises: exercises.map((exercise) => ({
          name: exercise.name,
          body_part: exercise.body_part,
          memo: exercise.memo,
          sets: exercise.sets.map((set) => ({
            weight_kg: set.weight_kg === '' ? null : Number(set.weight_kg),
            reps: set.reps === '' ? null : Number(set.reps),
            rpe: set.rpe === '' ? null : Number(set.rpe),
            rir: set.rir === '' ? null : Number(set.rir),
            set_type: set.set_type,
            side: set.side,
            memo: set.memo,
          })),
        })),
      }),
    [exercises],
  );

  const totalSets = exercises.reduce((sum, e) => sum + e.sets.length, 0);
  const totalVolume = exercises.reduce(
    (sum, e) =>
      sum +
      e.sets.reduce((setSum, s) => {
        const weight = Number(s.weight_kg || 0);
        const reps = Number(s.reps || 0);
        return setSum + weight * reps;
      }, 0),
    0,
  );

  const copySessionTemplate = (template: WorkoutTemplate) => {
    const source = template.session;
    setMainBodyPart(source.main_body_part ?? source.exercises[0]?.body_part ?? 'chest');
    setDurationMin(
      source.duration_min ? String(source.duration_min) : '',
    );
    setMemo(`${template.label}を${source.date}の最新メニューからコピー`);
    setExercises(
      source.exercises.length > 0
        ? source.exercises.map((exercise) => ({
            name: exercise.name,
            body_part: exercise.body_part,
            memo: exercise.memo ?? '',
            sets: exercise.sets.length
              ? exercise.sets.map((set) => ({
                  weight_kg:
                    set.weight_kg === null ? '' : String(Number(set.weight_kg)),
                  reps: set.reps === null ? '' : String(Number(set.reps)),
                  rpe: set.rpe === null ? '' : String(Number(set.rpe)),
                  rir: set.rir === null ? '' : String(Number(set.rir)),
                  set_type: set.set_type,
                  side: set.side,
                  memo: set.memo ?? '',
                }))
              : structuredClone(DEFAULT_EXERCISE.sets),
          }))
        : [structuredClone(DEFAULT_EXERCISE)],
    );
  };

  const addExercise = (template?: Partial<ExerciseInput>) => {
    setExercises((current) => [
      ...current,
      {
        ...structuredClone(DEFAULT_EXERCISE),
        ...template,
        sets: template?.sets ?? structuredClone(DEFAULT_EXERCISE.sets),
      },
    ]);
  };

  const patchExercise = (index: number, patch: Partial<ExerciseInput>) => {
    setExercises((current) =>
      current.map((exercise, i) =>
        i === index ? { ...exercise, ...patch } : exercise,
      ),
    );
  };

  const removeExercise = (index: number) => {
    setExercises((current) =>
      current.length === 1 ? current : current.filter((_, i) => i !== index),
    );
  };

  const patchSet = (
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<SetInput>,
  ) => {
    setExercises((current) =>
      current.map((exercise, i) =>
        i === exerciseIndex
          ? {
              ...exercise,
              sets: exercise.sets.map((set, j) =>
                j === setIndex ? { ...set, ...patch } : set,
              ),
            }
          : exercise,
      ),
    );
  };

  const addSet = (exerciseIndex: number) => {
    setExercises((current) =>
      current.map((exercise, i) =>
        i === exerciseIndex
          ? {
              ...exercise,
              sets: [
                ...exercise.sets,
                {
                  ...structuredClone(DEFAULT_EXERCISE.sets[0]),
                  weight_kg:
                    exercise.sets[exercise.sets.length - 1]?.weight_kg ?? '',
                  reps: exercise.sets[exercise.sets.length - 1]?.reps ?? '',
                },
              ],
            }
          : exercise,
      ),
    );
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setExercises((current) =>
      current.map((exercise, i) =>
        i === exerciseIndex
          ? {
              ...exercise,
              sets:
                exercise.sets.length === 1
                  ? exercise.sets
                  : exercise.sets.filter((_, j) => j !== setIndex),
            }
          : exercise,
      ),
    );
  };

  return (
    <div className="space-y-5">
      <div className="sport-card-strong p-5">
        <div className="sport-kicker">Training log</div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black leading-tight">筋トレメモ</h1>
            <p className="mt-1 text-sm text-slate-300">
              重量・回数・セットを残して、筋肉を守るための負荷推移を追います。
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#a3ff12] text-[#061006]">
            <Dumbbell size={25} strokeWidth={2.6} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <HeroMetric label="今週" value={`${stats.sessionsThisWeek}`} unit="回" />
          <HeroMetric label="セット" value={`${stats.setsThisWeek}`} unit="set" />
          <HeroMetric
            label="ボリューム"
            value={compactNumber(stats.volumeThisWeekKg)}
            unit="kg"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-1">
        {[
          { key: 'record', label: '今日の記録', icon: Plus },
          { key: 'history', label: '履歴', icon: Clock },
          { key: 'analysis', label: '分析', icon: BarChart3 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key as Tab)}
              className={`flex h-11 items-center justify-center gap-1 rounded-md text-xs font-bold transition ${
                tab === item.key
                  ? 'bg-[#a3ff12] text-[#061006]'
                  : 'text-slate-300'
              }`}
            >
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'record' && (
        <div className="space-y-4">
          {templates.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-200">
                    最新の部位メニューをコピー
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    胸+三頭、背中+二頭などの最新記録を反映します
                  </div>
                </div>
                <Copy size={18} className="shrink-0 text-[#a3ff12]" />
              </div>
              <div className="grid grid-cols-1 gap-2">
                {templates.map((template) => (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => copySessionTemplate(template)}
                    className="sport-card flex w-full items-center justify-between gap-3 p-4 text-left active:scale-[0.99]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-white">
                        {template.label}
                      </span>
                      <span className="mt-1 block text-xs text-slate-400">
                        {template.session.date} /{' '}
                        {template.session.exercises.length}種目 /{' '}
                        {template.session.totalSets}set /{' '}
                        {compactNumber(template.session.totalVolumeKg)}kg
                      </span>
                    </span>
                    <span className="rounded-full border border-[#a3ff12]/30 px-3 py-1 text-xs font-black text-[#a3ff12]">
                      反映
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {frequent.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-bold text-slate-200">
                よく使う種目
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {frequent.map((exercise) => (
                  <button
                    key={`${exercise.name}-${exercise.body_part}`}
                    type="button"
                    onClick={() =>
                      addExercise({
                        name: exercise.name,
                        body_part: exercise.body_part,
                      })
                    }
                    className="shrink-0 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-left text-xs"
                  >
                    <span className="block font-bold text-white">
                      {exercise.name}
                    </span>
                    <span className="text-slate-400">
                      {BODY_PART_LABELS[exercise.body_part]} / {exercise.count}回
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="payload" value={payload} />
            <WorkoutMetaFields
              date={date}
              setDate={setDate}
              startTime={startTime}
              setStartTime={setStartTime}
              durationMin={durationMin}
              setDurationMin={setDurationMin}
              mainBodyPart={mainBodyPart}
              setMainBodyPart={setMainBodyPart}
              effort={effort}
              setEffort={setEffort}
              memo={memo}
              setMemo={setMemo}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-100">
                  種目とセット
                </h2>
                <div className="text-xs text-slate-400">
                  {exercises.length}種目 / {totalSets}set /{' '}
                  {Math.round(totalVolume).toLocaleString()}kg
                </div>
              </div>

              {exercises.map((exercise, exerciseIndex) => (
                <ExerciseCard
                  key={exerciseIndex}
                  exercise={exercise}
                  exerciseIndex={exerciseIndex}
                  canRemove={exercises.length > 1}
                  onPatch={(patch) => patchExercise(exerciseIndex, patch)}
                  onRemove={() => removeExercise(exerciseIndex)}
                  onPatchSet={(setIndex, patch) =>
                    patchSet(exerciseIndex, setIndex, patch)
                  }
                  onAddSet={() => addSet(exerciseIndex)}
                  onRemoveSet={(setIndex) =>
                    removeSet(exerciseIndex, setIndex)
                  }
                />
              ))}

              <button
                type="button"
                onClick={() => addExercise()}
                className="sport-button-secondary flex h-12 w-full items-center justify-center gap-2"
              >
                <Plus size={18} />
                種目を追加
              </button>
            </div>

            {state && 'error' in state && (
              <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                {state.error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="sport-button-primary flex h-12 w-full items-center justify-center gap-2 disabled:opacity-60"
            >
              <Save size={18} />
              {pending ? '保存中...' : '筋トレを保存'}
            </button>
          </form>

          <form action={routineAction} className="sport-card space-y-3 p-4">
            <input type="hidden" name="payload" value={payload} />
            <input type="hidden" name="main_body_part" value={mainBodyPart} />
            <input type="hidden" name="memo" value={memo} />
            <label className="block text-sm font-bold text-slate-200">
              今の内容をルーティン保存
            </label>
            <div className="flex gap-2">
              <input
                name="routine_name"
                value={routineName}
                onChange={(e) => setRoutineName(e.target.value)}
                placeholder="例: 胸の日A"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-[#a3ff12]"
              />
              <button
                type="submit"
                disabled={routinePending}
                className="rounded-lg bg-white/10 px-3 text-sm font-bold text-[#a3ff12] disabled:opacity-60"
              >
                保存
              </button>
            </div>
            {routineState && 'error' in routineState && (
              <p className="text-xs text-rose-300">{routineState.error}</p>
            )}
            {routineState && 'ok' in routineState && routineState.ok && (
              <p className="text-xs text-[#a3ff12]">ルーティンを保存しました。</p>
            )}
          </form>
        </div>
      )}

      {tab === 'history' && (
        <HistoryList sessions={sessions.slice(0, 30)} />
      )}

      {tab === 'analysis' && (
        <AnalysisPanel stats={stats} sessions={sessions} />
      )}
    </div>
  );
}

function WorkoutMetaFields({
  date,
  setDate,
  startTime,
  setStartTime,
  durationMin,
  setDurationMin,
  mainBodyPart,
  setMainBodyPart,
  effort,
  setEffort,
  memo,
  setMemo,
}: {
  date: string;
  setDate: (value: string) => void;
  startTime: string;
  setStartTime: (value: string) => void;
  durationMin: string;
  setDurationMin: (value: string) => void;
  mainBodyPart: BodyPart;
  setMainBodyPart: (value: BodyPart) => void;
  effort: string;
  setEffort: (value: string) => void;
  memo: string;
  setMemo: (value: string) => void;
}) {
  return (
    <div className="sport-card space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="日付">
          <input
            type="date"
            name="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="sport-input"
          />
        </Field>
        <Field label="開始時刻">
          <input
            type="time"
            name="start_time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="sport-input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="時間">
          <input
            type="number"
            name="duration_min"
            inputMode="numeric"
            min={1}
            max={600}
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            placeholder="分"
            className="sport-input"
          />
        </Field>
        <Field label="体感強度">
          <input
            type="number"
            name="perceived_effort"
            inputMode="decimal"
            min={1}
            max={10}
            step={0.5}
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            placeholder="1-10"
            className="sport-input"
          />
        </Field>
      </div>

      <input type="hidden" name="main_body_part" value={mainBodyPart} />
      <div>
        <label className="mb-2 block text-sm font-bold text-slate-200">
          メイン部位
        </label>
        <div className="grid grid-cols-3 gap-2">
          {BODY_PARTS.map((part) => (
            <button
              key={part}
              type="button"
              onClick={() => setMainBodyPart(part)}
              className={`h-10 rounded-lg border text-xs font-bold ${
                mainBodyPart === part
                  ? 'border-[#a3ff12] bg-[#a3ff12] text-[#061006]'
                  : 'border-white/10 bg-white/[0.035] text-slate-300'
              }`}
            >
              {BODY_PART_LABELS[part]}
            </button>
          ))}
        </div>
      </div>

      <Field label="全体メモ">
        <textarea
          name="memo"
          rows={2}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="疲労感、フォーム、痛み、集中度など"
          className="sport-input min-h-20 py-3"
        />
      </Field>
    </div>
  );
}

function buildSplitTemplates(
  sessions: WorkoutSessionDetail[],
): WorkoutTemplate[] {
  const templates = new Map<string, WorkoutTemplate>();

  for (const session of sessions) {
    const parts = Array.from(
      new Set(session.exercises.map((exercise) => exercise.body_part)),
    ).sort((a, b) => SPLIT_ORDER.indexOf(a) - SPLIT_ORDER.indexOf(b));
    if (parts.length === 0) continue;

    const key = parts.join('|');
    if (!templates.has(key)) {
      templates.set(key, {
        key,
        label: splitLabel(parts),
        session,
      });
    }
  }

  return Array.from(templates.values()).slice(0, 8);
}

function splitLabel(parts: BodyPart[]): string {
  const has = (part: BodyPart) => parts.includes(part);
  if (has('chest') && has('triceps')) return '胸 + 三頭';
  if (has('back') && has('arms')) return '背中 + 二頭・前腕';
  if (has('shoulders') && has('arms')) return '肩 + 二頭・前腕';
  if (has('shoulders') && has('triceps')) return '肩 + 三頭';
  if (has('legs')) return '脚';
  if (has('core')) return '腹筋';
  if (has('chest')) return has('arms') ? '胸 + 腕' : '胸';
  if (has('back')) return '背中';
  if (has('shoulders')) return '肩';
  if (has('triceps')) return '三頭';
  if (has('arms')) return '二頭・前腕';
  return parts.map((part) => BODY_PART_LABELS[part]).join(' + ');
}

function ExerciseCard({
  exercise,
  exerciseIndex,
  canRemove,
  onPatch,
  onRemove,
  onPatchSet,
  onAddSet,
  onRemoveSet,
}: {
  exercise: ExerciseInput;
  exerciseIndex: number;
  canRemove: boolean;
  onPatch: (patch: Partial<ExerciseInput>) => void;
  onRemove: () => void;
  onPatchSet: (setIndex: number, patch: Partial<SetInput>) => void;
  onAddSet: () => void;
  onRemoveSet: (setIndex: number) => void;
}) {
  return (
    <div className="sport-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#a3ff12]/10 text-xs font-black text-[#a3ff12]">
          {BODY_PART_ICONS[exercise.body_part]}
        </div>
        <div className="min-w-0 flex-1">
          <input
            value={exercise.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder={`種目 ${exerciseIndex + 1}（例: ベンチプレス）`}
            className="w-full bg-transparent text-base font-black text-white outline-none placeholder:text-slate-500"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-300 disabled:opacity-30"
          aria-label="種目を削除"
        >
          <Trash2 size={17} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {BODY_PARTS.map((part) => (
          <button
            key={part}
            type="button"
            onClick={() => onPatch({ body_part: part })}
            className={`h-9 rounded-lg border text-xs font-bold ${
              exercise.body_part === part
                ? 'border-[#20e0ff] bg-[#20e0ff]/15 text-[#8feeff]'
                : 'border-white/10 bg-black/20 text-slate-400'
            }`}
          >
            {BODY_PART_LABELS[part]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {exercise.sets.map((set, setIndex) => (
          <div
            key={setIndex}
            className="rounded-lg border border-white/10 bg-black/20 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-black text-slate-300">
                SET {setIndex + 1}
              </div>
              <button
                type="button"
                onClick={() => onRemoveSet(setIndex)}
                disabled={exercise.sets.length === 1}
                className="text-xs font-bold text-rose-300 disabled:opacity-30"
              >
                削除
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniNumber
                label="重量kg"
                value={set.weight_kg}
                onChange={(value) => onPatchSet(setIndex, { weight_kg: value })}
                step="0.5"
              />
              <MiniNumber
                label="回数"
                value={set.reps}
                onChange={(value) => onPatchSet(setIndex, { reps: value })}
                step="1"
              />
              <MiniNumber
                label="RPE"
                value={set.rpe}
                onChange={(value) => onPatchSet(setIndex, { rpe: value })}
                step="0.5"
              />
              <MiniNumber
                label="RIR"
                value={set.rir}
                onChange={(value) => onPatchSet(setIndex, { rir: value })}
                step="0.5"
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                value={set.set_type}
                onChange={(e) =>
                  onPatchSet(setIndex, {
                    set_type: e.target.value as WorkoutSetType,
                  })
                }
                className="sport-input h-10 text-xs"
              >
                {SET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {WORKOUT_SET_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <select
                value={set.side}
                onChange={(e) =>
                  onPatchSet(setIndex, { side: e.target.value as WorkoutSide })
                }
                className="sport-input h-10 text-xs"
              >
                {SIDES.map((side) => (
                  <option key={side} value={side}>
                    {WORKOUT_SIDE_LABELS[side]}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={set.memo}
              onChange={(e) => onPatchSet(setIndex, { memo: e.target.value })}
              placeholder="セットメモ（任意）"
              className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-[#a3ff12]"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAddSet}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#a3ff12]/30 bg-[#a3ff12]/10 text-sm font-black text-[#a3ff12]"
      >
        <Plus size={16} />
        セット追加
      </button>

      <textarea
        value={exercise.memo}
        onChange={(e) => onPatch({ memo: e.target.value })}
        placeholder="種目メモ（フォーム、グリップ、椅子位置など）"
        rows={2}
        className="sport-input min-h-16 py-3 text-sm"
      />
    </div>
  );
}

function HistoryList({ sessions }: { sessions: WorkoutSessionDetail[] }) {
  const router = useRouter();

  if (sessions.length === 0) {
    return (
      <div className="sport-card p-5 text-sm text-slate-300">
        まだ筋トレ記録がありません。今日の記録から最初のセットを保存してください。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <div key={session.id} className="sport-card space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black text-white">
                {session.date}
                {session.start_time ? ` ${session.start_time}` : ''}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {session.main_body_part
                  ? BODY_PART_LABELS[session.main_body_part]
                  : '部位未設定'}{' '}
                / {session.totalSets}set /{' '}
                {Math.round(session.totalVolumeKg).toLocaleString()}kg
                {session.duration_min ? ` / ${session.duration_min}分` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (confirm('この筋トレ記録を削除しますか？')) {
                  await deleteWorkoutSessionAction(session.id);
                  router.refresh();
                }
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-300"
              aria-label="筋トレ記録を削除"
            >
              <Trash2 size={17} />
            </button>
          </div>

          <div className="space-y-2">
            {session.exercises.map((exercise) => (
              <div
                key={exercise.id}
                className="rounded-lg border border-white/10 bg-black/20 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-white">{exercise.name}</div>
                  <div className="text-xs text-slate-400">
                    {BODY_PART_LABELS[exercise.body_part]}
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-300">
                  {exercise.sets
                    .map((set) => {
                      const weight =
                        set.weight_kg === null
                          ? '-'
                          : `${Number(set.weight_kg).toFixed(1)}kg`;
                      const reps =
                        set.reps === null ? '-' : `${Number(set.reps)}回`;
                      return `${weight} x ${reps}`;
                    })
                    .join(' / ')}
                </div>
              </div>
            ))}
          </div>

          {session.memo && (
            <p className="whitespace-pre-wrap text-xs text-slate-400">
              {session.memo}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function AnalysisPanel({
  stats,
  sessions,
}: {
  stats: WorkoutStats;
  sessions: WorkoutSessionDetail[];
}) {
  const latest = sessions[0] ?? null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Activity} label="今月の回数" value={`${stats.sessionsThisMonth}回`} />
        <StatCard icon={Flame} label="今月セット" value={`${stats.setsThisMonth}set`} />
        <StatCard
          icon={BarChart3}
          label="今月ボリューム"
          value={`${compactNumber(stats.volumeThisMonthKg)}kg`}
        />
        <StatCard
          icon={RotateCcw}
          label="休息日数"
          value={stats.restDays === null ? '-' : `${stats.restDays}日`}
        />
      </div>

      <div className="sport-card p-4">
        <h2 className="mb-3 text-sm font-black text-white">部位別セット数</h2>
        {stats.bodyPartSets.length === 0 ? (
          <p className="text-sm text-slate-400">まだ分析できる記録がありません。</p>
        ) : (
          <div className="space-y-3">
            {stats.bodyPartSets.map((part) => {
              const max = Math.max(...stats.bodyPartSets.map((p) => p.sets), 1);
              return (
                <div key={part.body_part}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-bold text-slate-200">
                      {BODY_PART_LABELS[part.body_part]}
                    </span>
                    <span className="text-slate-400">
                      {part.sets}set / {compactNumber(part.volumeKg)}kg
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-[#a3ff12]"
                      style={{ width: `${Math.max(8, (part.sets / max) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {latest && (
        <div className="sport-card p-4">
          <h2 className="mb-2 text-sm font-black text-white">前回の内容</h2>
          <p className="text-sm text-slate-300">
            {latest.date} / {latest.exercises.length}種目 / {latest.totalSets}set
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {latest.exercises.slice(0, 6).map((exercise) => (
              <span
                key={exercise.id}
                className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs text-slate-300"
              >
                {exercise.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-slate-200">
        {label}
      </span>
      {children}
    </label>
  );
}

function MiniNumber({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-slate-400">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm font-bold text-white outline-none focus:border-[#a3ff12]"
      />
    </label>
  );
}

function HeroMetric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-center">
      <div className="text-[10px] font-bold uppercase text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-xl font-black tabular-nums text-white">
        {value}
        <span className="ml-1 text-xs text-slate-400">{unit}</span>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="sport-card p-4">
      <Icon size={18} className="text-[#a3ff12]" />
      <div className="mt-3 text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-black text-white">{value}</div>
    </div>
  );
}

function compactNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`;
  return Math.round(value).toLocaleString();
}
