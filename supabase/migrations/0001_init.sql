-- 体重管理ツール: 初期スキーマ
-- 実行方法: Supabase Dashboard → SQL Editor に貼り付けて Run

-- ===========================
-- profiles テーブル
-- ===========================
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  height_cm numeric(5,1) not null check (height_cm between 100 and 250),
  gender text not null check (gender in ('male','female')),
  age int not null check (age between 10 and 100),
  current_weight_kg numeric(5,2) not null check (current_weight_kg between 30 and 300),
  body_fat_pct numeric(4,1) not null check (body_fat_pct between 3 and 60),
  training_freq text not null check (training_freq in ('none','1-2','3-4','5+')),
  target_weight_kg numeric(5,2) not null check (target_weight_kg between 30 and 300),
  target_body_fat_pct numeric(4,1) not null check (target_body_fat_pct between 3 and 60),
  target_period text not null check (target_period in ('1mo','3mo','6mo','1yr')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================
-- meal_logs テーブル
-- ===========================
create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  calories numeric(7,1) not null check (calories >= 0),
  protein_g numeric(6,1) not null check (protein_g >= 0),
  fat_g numeric(6,1) not null check (fat_g >= 0),
  carbs_g numeric(6,1) not null check (carbs_g >= 0),
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists meal_logs_user_date_idx
  on public.meal_logs (user_id, date desc);

-- ===========================
-- updated_at トリガー
-- ===========================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- ===========================
-- Row Level Security
-- ===========================
alter table public.profiles enable row level security;
alter table public.meal_logs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id);

drop policy if exists "meal_logs_select_own" on public.meal_logs;
drop policy if exists "meal_logs_insert_own" on public.meal_logs;
drop policy if exists "meal_logs_update_own" on public.meal_logs;
drop policy if exists "meal_logs_delete_own" on public.meal_logs;

create policy "meal_logs_select_own" on public.meal_logs
  for select using (auth.uid() = user_id);
create policy "meal_logs_insert_own" on public.meal_logs
  for insert with check (auth.uid() = user_id);
create policy "meal_logs_update_own" on public.meal_logs
  for update using (auth.uid() = user_id);
create policy "meal_logs_delete_own" on public.meal_logs
  for delete using (auth.uid() = user_id);
