-- 体重管理ツール: Neon Postgres スキーマ
-- 実行方法: Neon Console → SQL Editor に貼り付けて Run、または `npm run db:migrate` を使用

-- ===========================
-- users テーブル（メール+パスワード認証）
-- ===========================
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null check (length(email) <= 255),
  password_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists users_email_idx on users (email);

-- ===========================
-- profiles テーブル
-- ===========================
create table if not exists profiles (
  user_id uuid primary key references users(id) on delete cascade,
  height_cm numeric(5,1) not null check (height_cm between 100 and 250),
  gender text not null check (gender in ('male','female')),
  age int not null check (age between 10 and 100),
  current_weight_kg numeric(5,2) not null check (current_weight_kg between 30 and 300),
  body_fat_pct numeric(4,1) not null check (body_fat_pct between 3 and 60),
  training_freq text not null check (training_freq in ('none','1-2','3-4','5+')),
  target_weight_kg numeric(5,2) not null check (target_weight_kg between 30 and 300),
  target_body_fat_pct numeric(4,1) not null check (target_body_fat_pct between 3 and 60),
  target_period text not null check (target_period in ('1mo','3mo','6mo','1yr')),
  cheat_day_enabled boolean not null default true,
  cheat_day_frequency text not null default 'auto' check (cheat_day_frequency in ('auto','weekly','biweekly','monthly','event_only')),
  birthday_mmdd text not null default '06-25' check (birthday_mmdd ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================
-- meal_logs テーブル
-- ===========================
create table if not exists meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  calories numeric(7,1) not null check (calories >= 0),
  protein_g numeric(6,1) not null check (protein_g >= 0),
  fat_g numeric(6,1) not null check (fat_g >= 0),
  carbs_g numeric(6,1) not null check (carbs_g >= 0),
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists meal_logs_user_date_idx
  on meal_logs (user_id, date desc);

-- ===========================
-- hydration_logs テーブル
-- ===========================
create table if not exists hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  time time,
  drink_type text not null check (drink_type in ('water','protein','coffee','other')),
  amount_ml int not null check (amount_ml between 100 and 3000 and amount_ml % 100 = 0),
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists hydration_logs_user_date_idx
  on hydration_logs (user_id, date desc, time desc, created_at desc);

-- ===========================
-- updated_at トリガー
-- ===========================
create or replace function handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row execute function handle_updated_at();
