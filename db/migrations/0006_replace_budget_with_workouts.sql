-- 0006: 家計簿を削除し、筋トレ記録へ置き換える
-- 注意: transactions / recurring_expenses の既存データは削除されます。

drop table if exists recurring_expenses cascade;
drop table if exists transactions cascade;

create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  start_time time,
  duration_min int check (duration_min is null or duration_min between 1 and 600),
  main_body_part text check (
    main_body_part is null or main_body_part in (
      'chest','back','legs','shoulders','arms','core','cardio','full_body','other'
    )
  ),
  perceived_effort smallint check (
    perceived_effort is null or perceived_effort between 1 and 10
  ),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workout_sessions_user_date_idx
  on workout_sessions (user_id, date desc, created_at desc);

create table if not exists workout_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout_sessions(id) on delete cascade,
  exercise_order int not null check (exercise_order >= 1),
  name text not null check (length(name) <= 80),
  body_part text not null check (
    body_part in (
      'chest','back','legs','shoulders','arms','core','cardio','full_body','other'
    )
  ),
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists workout_exercises_session_idx
  on workout_exercises (session_id, exercise_order);
create index if not exists workout_exercises_name_idx
  on workout_exercises (lower(name));

create table if not exists workout_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references workout_exercises(id) on delete cascade,
  set_order int not null check (set_order >= 1),
  weight_kg numeric(6,2) check (weight_kg is null or weight_kg between 0 and 1000),
  reps int check (reps is null or reps between 0 and 1000),
  rpe numeric(3,1) check (rpe is null or rpe between 1 and 10),
  rir numeric(3,1) check (rir is null or rir between 0 and 10),
  set_type text not null default 'working' check (
    set_type in ('warmup','working','drop','failure')
  ),
  side text not null default 'both' check (side in ('both','left','right')),
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists workout_sets_exercise_idx
  on workout_sets (exercise_id, set_order);

create table if not exists workout_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null check (length(name) <= 80),
  main_body_part text check (
    main_body_part is null or main_body_part in (
      'chest','back','legs','shoulders','arms','core','cardio','full_body','other'
    )
  ),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workout_routines_user_idx
  on workout_routines (user_id, created_at desc);

create table if not exists workout_routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references workout_routines(id) on delete cascade,
  exercise_order int not null check (exercise_order >= 1),
  name text not null check (length(name) <= 80),
  body_part text not null check (
    body_part in (
      'chest','back','legs','shoulders','arms','core','cardio','full_body','other'
    )
  ),
  target_sets int check (target_sets is null or target_sets between 1 and 30),
  target_reps int check (target_reps is null or target_reps between 1 and 1000),
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists workout_routine_exercises_routine_idx
  on workout_routine_exercises (routine_id, exercise_order);

drop trigger if exists workout_sessions_updated_at on workout_sessions;
create trigger workout_sessions_updated_at
  before update on workout_sessions
  for each row execute function handle_updated_at();

drop trigger if exists workout_routines_updated_at on workout_routines;
create trigger workout_routines_updated_at
  before update on workout_routines
  for each row execute function handle_updated_at();
