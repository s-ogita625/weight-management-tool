-- 0004: 固定費（毎月自動で支出に加算する定期費用）

create table if not exists recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,

  -- 表示用
  name text not null check (length(name) <= 60),
  category text not null,
  amount numeric(12,2) not null check (amount >= 0),

  -- 引き落とし日 (1-31)
  billing_day smallint not null check (billing_day between 1 and 31),

  -- 用途・メモ
  purpose text,

  -- 有効期間 (YYYY-MM 文字列で柔軟に管理)
  start_month text not null, -- YYYY-MM
  end_month text,            -- YYYY-MM、null=無期限

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_expenses_user_idx
  on recurring_expenses (user_id, is_active);

drop trigger if exists recurring_expenses_updated_at on recurring_expenses;
create trigger recurring_expenses_updated_at
  before update on recurring_expenses
  for each row execute function handle_updated_at();
