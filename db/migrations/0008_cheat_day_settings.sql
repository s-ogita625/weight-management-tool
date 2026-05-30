-- 0008: チートデイ/リフィード設定

alter table profiles
  add column if not exists cheat_day_enabled boolean not null default true;

alter table profiles
  add column if not exists cheat_day_frequency text not null default 'auto';

alter table profiles
  add column if not exists birthday_mmdd text not null default '06-25';

alter table profiles
  drop constraint if exists profiles_cheat_day_frequency_check,
  add constraint profiles_cheat_day_frequency_check
    check (cheat_day_frequency in ('auto','weekly','biweekly','monthly','event_only'));

alter table profiles
  drop constraint if exists profiles_birthday_mmdd_check,
  add constraint profiles_birthday_mmdd_check
    check (birthday_mmdd ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');
