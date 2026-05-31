-- 0010: 年4回の自動フリーデイ設定

alter table profiles
  drop constraint if exists profiles_cheat_day_frequency_check,
  add constraint profiles_cheat_day_frequency_check
    check (cheat_day_frequency in ('auto','weekly','biweekly','monthly','quarterly_free','event_only'));

alter table profiles
  alter column cheat_day_frequency set default 'quarterly_free';

update profiles
set cheat_day_frequency = 'quarterly_free'
where cheat_day_frequency in ('auto','weekly','biweekly','monthly','event_only');

