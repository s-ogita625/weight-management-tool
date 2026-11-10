-- 0014: 回復度（疲労度の推定）用に、安静時心拍と HRV を保存する
alter table wearable_daily add column if not exists resting_hr int;
alter table wearable_daily add column if not exists hrv_ms numeric(5,1);
