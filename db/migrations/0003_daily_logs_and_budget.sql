-- 0003: 日次ログ（朝の体重・体脂肪・コンディション）と家計簿テーブル

-- ===========================
-- daily_logs: 1日1レコード（朝に体重・体脂肪・コンディションを記録）
-- ===========================
create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,

  -- 体組成
  weight_kg numeric(5,2) check (weight_kg is null or weight_kg between 30 and 300),
  body_fat_pct numeric(4,1) check (body_fat_pct is null or body_fat_pct between 3 and 60),

  -- コンディション
  sleep_hours numeric(3,1) check (sleep_hours is null or sleep_hours between 0 and 24),
  sleep_quality smallint check (sleep_quality is null or sleep_quality between 1 and 5),
  fatigue smallint check (fatigue is null or fatigue between 1 and 5), -- 1=とても元気, 5=とても疲れ
  mood smallint check (mood is null or mood between 1 and 5), -- 1=最悪, 5=最高
  bowel text check (bowel is null or bowel in ('none','soft','normal','firm','diarrhea')),

  -- 自由記述・カスタム項目（JSONB で柔軟に追加可）
  memo text,
  custom_fields jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, date)
);

create index if not exists daily_logs_user_date_idx
  on daily_logs (user_id, date desc);

drop trigger if exists daily_logs_updated_at on daily_logs;
create trigger daily_logs_updated_at
  before update on daily_logs
  for each row execute function handle_updated_at();

-- ===========================
-- transactions: 家計簿（収入・支出）
-- ===========================
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  -- 種別
  kind text not null check (kind in ('income','expense')),
  -- カテゴリ（自由文字列、よく使うものは UI で候補表示）
  category text not null,
  amount numeric(12,2) not null check (amount >= 0),
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on transactions (user_id, date desc);
create index if not exists transactions_user_kind_category_idx
  on transactions (user_id, kind, category);
