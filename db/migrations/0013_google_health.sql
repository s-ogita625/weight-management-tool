-- 0013: Google Health API（Fitbit Air など）連携

-- 連携状態とトークン（トークンは AES-256-GCM で暗号化して保存）
create table if not exists health_connections (
  user_id uuid primary key references users(id) on delete cascade,
  refresh_token_enc text not null,
  access_token_enc text,
  access_expires_at timestamptz,
  scopes text not null default '',
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_error text
);

-- ウェアラブルの1日分のまとめ（Google Health API から同期）
create table if not exists wearable_daily (
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  steps int,
  total_kcal numeric(7,1),
  distance_km numeric(6,2),
  active_zone_minutes int,
  sleep_minutes int,
  sleep_start timestamptz,
  sleep_end timestamptz,
  deep_minutes int,
  rem_minutes int,
  light_minutes int,
  awake_minutes int,
  exercises jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (user_id, date)
);
