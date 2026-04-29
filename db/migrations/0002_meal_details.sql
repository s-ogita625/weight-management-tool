-- 0002: meal_logs に時間・食事区分・料理名カラムを追加
-- 既存データへの影響を抑えるため、すべて NULL 許容で追加

alter table meal_logs
  add column if not exists time time,
  add column if not exists meal_type text
    check (meal_type in ('breakfast','lunch','dinner','snack','pre_workout','post_workout')),
  add column if not exists food_name text;

create index if not exists meal_logs_user_date_time_idx
  on meal_logs (user_id, date desc, time desc nulls last);

-- AI チャット履歴用テーブル
create table if not exists ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_messages_user_created_idx
  on ai_chat_messages (user_id, created_at desc);
