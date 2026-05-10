-- 0005: リーンカット機能と文献リサーチ機能

-- profiles に lean_cut_mode フラグと priority を追加
alter table profiles
  add column if not exists lean_cut_mode boolean not null default false;

alter table profiles
  add column if not exists priority text
    check (priority in ('fat_loss','muscle_retention','recomposition'))
    default 'fat_loss';

-- 文献リサーチキャッシュ
create table if not exists research_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  topic text not null,
  focus text,
  summary text not null,
  citations jsonb not null default '[]'::jsonb,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists research_articles_user_topic_idx
  on research_articles (user_id, topic, created_at desc);
create index if not exists research_articles_user_favorite_idx
  on research_articles (user_id, is_favorite, created_at desc);
