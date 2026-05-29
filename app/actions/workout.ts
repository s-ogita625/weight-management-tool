'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { sql } from '@/lib/db';
import type { BodyPart, WorkoutSetType, WorkoutSide } from '@/lib/types';

const BODY_PARTS = new Set<BodyPart>([
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'cardio',
  'full_body',
  'other',
]);
const SET_TYPES = new Set<WorkoutSetType>([
  'warmup',
  'working',
  'drop',
  'failure',
]);
const SIDES = new Set<WorkoutSide>(['both', 'left', 'right']);

type WorkoutPayload = {
  exercises: Array<{
    name: string;
    body_part: BodyPart;
    memo?: string | null;
    sets: Array<{
      weight_kg?: number | null;
      reps?: number | null;
      rpe?: number | null;
      rir?: number | null;
      set_type?: WorkoutSetType;
      side?: WorkoutSide;
      memo?: string | null;
    }>;
  }>;
};

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function optionalNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function cleanMemo(value: unknown, max = 500): string | null {
  const s = String(value ?? '').trim();
  return s ? s.slice(0, max) : null;
}

function parsePayload(formData: FormData): WorkoutPayload | { error: string } {
  const raw = str(formData, 'payload');
  if (!raw) return { error: '種目を1つ以上入力してください' };

  let parsed: WorkoutPayload;
  try {
    parsed = JSON.parse(raw) as WorkoutPayload;
  } catch {
    return { error: '筋トレ記録の形式が不正です' };
  }

  const exercises = (parsed.exercises ?? [])
    .map((exercise) => ({
      name: String(exercise.name ?? '').trim().slice(0, 80),
      body_part: BODY_PARTS.has(exercise.body_part)
        ? exercise.body_part
        : ('other' as BodyPart),
      memo: cleanMemo(exercise.memo, 300),
      sets: (exercise.sets ?? [])
        .map((set) => ({
          weight_kg: optionalNumber(set.weight_kg),
          reps: optionalNumber(set.reps),
          rpe: optionalNumber(set.rpe),
          rir: optionalNumber(set.rir),
          set_type: SET_TYPES.has(set.set_type ?? 'working')
            ? (set.set_type ?? 'working')
            : ('working' as WorkoutSetType),
          side: SIDES.has(set.side ?? 'both')
            ? (set.side ?? 'both')
            : ('both' as WorkoutSide),
          memo: cleanMemo(set.memo, 200),
        }))
        .filter((set) => set.weight_kg !== null || set.reps !== null),
    }))
    .filter((exercise) => exercise.name && exercise.sets.length > 0);

  if (exercises.length === 0) {
    return { error: '種目名とセット内容を1つ以上入力してください' };
  }
  if (exercises.length > 30) {
    return { error: '1回の記録に入れられる種目は30個までです' };
  }
  for (const exercise of exercises) {
    if (exercise.sets.length > 40) {
      return { error: '1種目に入れられるセットは40個までです' };
    }
    for (const set of exercise.sets) {
      if (
        (set.weight_kg !== null && (set.weight_kg < 0 || set.weight_kg > 1000)) ||
        (set.reps !== null && (set.reps < 0 || set.reps > 1000)) ||
        (set.rpe !== null && (set.rpe < 1 || set.rpe > 10)) ||
        (set.rir !== null && (set.rir < 0 || set.rir > 10))
      ) {
        return { error: 'セットの数値が範囲外です' };
      }
    }
  }

  return { exercises };
}

export async function addWorkoutSessionAction(
  _prev: unknown,
  formData: FormData,
) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const date = str(formData, 'date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: '日付が必要です' };
  }

  const startTime = str(formData, 'start_time') || null;
  const durationMin = optionalNumber(formData.get('duration_min'));
  const mainBodyPartRaw = str(formData, 'main_body_part');
  const mainBodyPart = BODY_PARTS.has(mainBodyPartRaw as BodyPart)
    ? (mainBodyPartRaw as BodyPart)
    : null;
  const perceivedEffort = optionalNumber(formData.get('perceived_effort'));
  const memo = cleanMemo(formData.get('memo'), 1000);
  const payload = parsePayload(formData);

  if ('error' in payload) return payload;
  if (durationMin !== null && (durationMin < 1 || durationMin > 600)) {
    return { error: 'トレーニング時間は1〜600分で入力してください' };
  }
  if (
    perceivedEffort !== null &&
    (perceivedEffort < 1 || perceivedEffort > 10)
  ) {
    return { error: '体感強度は1〜10で入力してください' };
  }

  const sessionRows = await sql`
    insert into workout_sessions (
      user_id, date, start_time, duration_min,
      main_body_part, perceived_effort, memo
    ) values (
      ${userId}, ${date}, ${startTime}, ${durationMin},
      ${mainBodyPart}, ${perceivedEffort}, ${memo}
    )
    returning id
  `;
  const sessionId = (sessionRows as unknown as Array<{ id: string }>)[0]?.id;
  if (!sessionId) return { error: '筋トレ記録の保存に失敗しました' };

  let exerciseOrder = 1;
  for (const exercise of payload.exercises) {
    const exerciseRows = await sql`
      insert into workout_exercises (
        session_id, exercise_order, name, body_part, memo
      ) values (
        ${sessionId}, ${exerciseOrder}, ${exercise.name},
        ${exercise.body_part}, ${exercise.memo}
      )
      returning id
    `;
    const exerciseId = (exerciseRows as unknown as Array<{ id: string }>)[0]?.id;
    if (!exerciseId) continue;

    let setOrder = 1;
    for (const set of exercise.sets) {
      await sql`
        insert into workout_sets (
          exercise_id, set_order, weight_kg, reps,
          rpe, rir, set_type, side, memo
        ) values (
          ${exerciseId}, ${setOrder}, ${set.weight_kg}, ${set.reps},
          ${set.rpe}, ${set.rir}, ${set.set_type}, ${set.side}, ${set.memo}
        )
      `;
      setOrder += 1;
    }
    exerciseOrder += 1;
  }

  revalidateWorkoutPaths();
  return { ok: true as const };
}

export async function deleteWorkoutSessionAction(id: string) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  await sql`
    delete from workout_sessions
    where id = ${id} and user_id = ${userId}
  `;
  revalidateWorkoutPaths();
}

export async function saveWorkoutRoutineAction(
  _prev: unknown,
  formData: FormData,
) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const name = str(formData, 'routine_name').slice(0, 80);
  if (!name) return { error: 'ルーティン名が必要です' };

  const mainBodyPartRaw = str(formData, 'main_body_part');
  const mainBodyPart = BODY_PARTS.has(mainBodyPartRaw as BodyPart)
    ? (mainBodyPartRaw as BodyPart)
    : null;
  const memo = cleanMemo(formData.get('memo'), 500);
  const payload = parsePayload(formData);
  if ('error' in payload) return payload;

  const routineRows = await sql`
    insert into workout_routines (user_id, name, main_body_part, memo)
    values (${userId}, ${name}, ${mainBodyPart}, ${memo})
    returning id
  `;
  const routineId = (routineRows as unknown as Array<{ id: string }>)[0]?.id;
  if (!routineId) return { error: 'ルーティン保存に失敗しました' };

  let order = 1;
  for (const exercise of payload.exercises) {
    const firstSet = exercise.sets[0];
    await sql`
      insert into workout_routine_exercises (
        routine_id, exercise_order, name, body_part,
        target_sets, target_reps, memo
      ) values (
        ${routineId}, ${order}, ${exercise.name}, ${exercise.body_part},
        ${exercise.sets.length}, ${firstSet?.reps ?? null}, ${exercise.memo}
      )
    `;
    order += 1;
  }

  revalidateWorkoutPaths();
  return { ok: true as const };
}

function revalidateWorkoutPaths() {
  revalidatePath('/workout');
  revalidatePath('/trend');
  revalidatePath('/coach');
  revalidatePath('/chat');
  revalidatePath('/');
}
