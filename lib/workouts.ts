import 'server-only';

import { dateInJST } from '@/lib/date';
import { sql } from '@/lib/db';
import { daysBetween } from '@/lib/stats';
import type {
  BodyPart,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSessionDetail,
  WorkoutSet,
  WorkoutStats,
} from '@/lib/types';

type SessionRow = Omit<WorkoutSession, 'date' | 'start_time'> & {
  date: string;
  start_time: string | null;
};

type ExerciseRow = Omit<WorkoutExercise, 'sets'>;
type SetRow = WorkoutSet;

export async function getWorkoutSessions(
  userId: string,
  limit = 30,
): Promise<WorkoutSessionDetail[]> {
  const sessionsRaw = await sql`
    select id, user_id, to_char(date, 'YYYY-MM-DD') as date,
           to_char(start_time, 'HH24:MI') as start_time,
           duration_min, main_body_part, perceived_effort, memo,
           created_at, updated_at
    from workout_sessions
    where user_id = ${userId}
    order by date desc, start_time desc nulls last, created_at desc
    limit ${limit}
  `;
  const sessions = sessionsRaw as unknown as SessionRow[];
  if (sessions.length === 0) return [];

  const ids = sessions.map((s) => s.id);
  const exercisesRaw = await sql`
    select e.id, e.session_id, e.exercise_order, e.name,
           e.body_part, e.memo, e.created_at
    from workout_exercises e
    where e.session_id = any(${ids}::uuid[])
    order by e.session_id, e.exercise_order
  `;
  const exercises = exercisesRaw as unknown as ExerciseRow[];
  const exerciseIds = exercises.map((e) => e.id);
  const setsRaw =
    exerciseIds.length > 0
      ? await sql`
          select id, exercise_id, set_order, weight_kg, reps, rpe, rir,
                 set_type, side, memo, created_at
          from workout_sets
          where exercise_id = any(${exerciseIds}::uuid[])
          order by exercise_id, set_order
        `
      : [];
  const sets = setsRaw as unknown as SetRow[];

  const setsByExercise = new Map<string, WorkoutSet[]>();
  for (const set of sets) {
    const list = setsByExercise.get(set.exercise_id) ?? [];
    list.push(set);
    setsByExercise.set(set.exercise_id, list);
  }

  const exercisesBySession = new Map<string, WorkoutExercise[]>();
  for (const exercise of exercises) {
    const list = exercisesBySession.get(exercise.session_id) ?? [];
    list.push({
      ...exercise,
      body_part: exercise.body_part as BodyPart,
      sets: setsByExercise.get(exercise.id) ?? [],
    });
    exercisesBySession.set(exercise.session_id, list);
  }

  return sessions.map((session) => {
    const detailExercises = exercisesBySession.get(session.id) ?? [];
    const totalSets = detailExercises.reduce(
      (sum, exercise) => sum + exercise.sets.length,
      0,
    );
    const totalVolumeKg = detailExercises.reduce(
      (sum, exercise) =>
        sum +
        exercise.sets.reduce((setSum, set) => {
          const weight = Number(set.weight_kg ?? 0);
          const reps = Number(set.reps ?? 0);
          return setSum + weight * reps;
        }, 0),
      0,
    );

    return {
      ...session,
      main_body_part: session.main_body_part as BodyPart | null,
      exercises: detailExercises,
      totalSets,
      totalVolumeKg,
    };
  });
}

export async function getWorkoutStats(userId: string): Promise<WorkoutStats> {
  const today = dateInJST();
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekStart = addDays(today, -6);

  const [summaryRaw, bodyPartsRaw, frequentRaw, lastRaw] = await Promise.all([
    sql`
      select
        count(distinct case when s.date >= ${weekStart} then s.id end)::int as sessions_week,
        count(distinct case when s.date >= ${monthStart} then s.id end)::int as sessions_month,
        count(case when s.date >= ${weekStart} then ws.id end)::int as sets_week,
        count(case when s.date >= ${monthStart} then ws.id end)::int as sets_month,
        coalesce(sum(case when s.date >= ${weekStart}
          then coalesce(ws.weight_kg,0) * coalesce(ws.reps,0) else 0 end),0)::float as volume_week,
        coalesce(sum(case when s.date >= ${monthStart}
          then coalesce(ws.weight_kg,0) * coalesce(ws.reps,0) else 0 end),0)::float as volume_month
      from workout_sessions s
      left join workout_exercises e on e.session_id = s.id
      left join workout_sets ws on ws.exercise_id = e.id
      where s.user_id = ${userId}
    `,
    sql`
      select e.body_part,
             count(ws.id)::int as sets,
             coalesce(sum(coalesce(ws.weight_kg,0) * coalesce(ws.reps,0)),0)::float as volume
      from workout_sessions s
      join workout_exercises e on e.session_id = s.id
      left join workout_sets ws on ws.exercise_id = e.id
      where s.user_id = ${userId}
        and s.date >= ${monthStart}
      group by e.body_part
      order by sets desc
    `,
    sql`
      select e.name, e.body_part, count(*)::int as count
      from workout_sessions s
      join workout_exercises e on e.session_id = s.id
      where s.user_id = ${userId}
      group by e.name, e.body_part
      order by count desc, max(s.date) desc
      limit 10
    `,
    sql`
      select to_char(date, 'YYYY-MM-DD') as date
      from workout_sessions
      where user_id = ${userId}
      order by date desc, created_at desc
      limit 1
    `,
  ]);

  const summary = (summaryRaw as unknown as Array<{
    sessions_week: number;
    sessions_month: number;
    sets_week: number;
    sets_month: number;
    volume_week: number;
    volume_month: number;
  }>)[0];
  const lastDate =
    (lastRaw as unknown as Array<{ date: string }>)[0]?.date ?? null;

  return {
    sessionsThisWeek: summary?.sessions_week ?? 0,
    sessionsThisMonth: summary?.sessions_month ?? 0,
    setsThisWeek: summary?.sets_week ?? 0,
    setsThisMonth: summary?.sets_month ?? 0,
    volumeThisWeekKg: Math.round(summary?.volume_week ?? 0),
    volumeThisMonthKg: Math.round(summary?.volume_month ?? 0),
    lastWorkoutDate: lastDate,
    restDays: lastDate ? Math.max(0, daysBetween(lastDate, today)) : null,
    bodyPartSets: (bodyPartsRaw as unknown as Array<{
      body_part: BodyPart;
      sets: number;
      volume: number;
    }>).map((r) => ({
      body_part: r.body_part,
      sets: Number(r.sets),
      volumeKg: Math.round(Number(r.volume)),
    })),
    frequentExercises: (frequentRaw as unknown as Array<{
      name: string;
      body_part: BodyPart;
      count: number;
    }>).map((r) => ({
      name: r.name,
      body_part: r.body_part,
      count: Number(r.count),
    })),
  };
}

export async function getLastExercisePerformance(
  userId: string,
  names: string[],
) {
  const clean = Array.from(
    new Set(names.map((name) => name.trim()).filter(Boolean)),
  ).slice(0, 20);
  if (clean.length === 0) return new Map<string, string>();

  const rows = await sql`
    select distinct on (lower(e.name))
      e.name,
      to_char(s.date, 'YYYY-MM-DD') as date,
      coalesce(max(ws.weight_kg),0)::float as max_weight,
      coalesce(max(ws.reps),0)::int as max_reps,
      count(ws.id)::int as sets
    from workout_sessions s
    join workout_exercises e on e.session_id = s.id
    left join workout_sets ws on ws.exercise_id = e.id
    where s.user_id = ${userId}
      and lower(e.name) = any(${clean.map((n) => n.toLowerCase())}::text[])
    group by lower(e.name), e.name, s.date, s.created_at
    order by lower(e.name), s.date desc, s.created_at desc
  `;

  const result = new Map<string, string>();
  for (const row of rows as unknown as Array<{
    name: string;
    date: string;
    max_weight: number;
    max_reps: number;
    sets: number;
  }>) {
    result.set(
      row.name.toLowerCase(),
      `${row.date} / ${row.sets}set / 最大${Number(row.max_weight).toFixed(1)}kg x ${row.max_reps}回`,
    );
  }
  return result;
}

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00+09:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
