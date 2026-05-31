-- 0009: 水分補給ログ

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

