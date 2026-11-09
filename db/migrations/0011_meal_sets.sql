-- 0011: 食事セット（「いつもの朝食」などをワンタップで登録するためのテンプレート）

create table if not exists meal_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null check (length(name) between 1 and 40),
  meal_type text check (
    meal_type is null or meal_type in ('breakfast','lunch','dinner','snack','pre_workout','post_workout')
  ),
  -- [{food_name, calories, protein_g, fat_g, carbs_g}]
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists meal_sets_user_idx on meal_sets (user_id, created_at desc);

drop trigger if exists meal_sets_updated_at on meal_sets;
create trigger meal_sets_updated_at
  before update on meal_sets
  for each row execute function handle_updated_at();
