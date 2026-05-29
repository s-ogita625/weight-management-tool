-- 0007: FITPLACEの黄緑ドット（三頭）に対応

alter table workout_sessions
  drop constraint if exists workout_sessions_main_body_part_check;
alter table workout_sessions
  add constraint workout_sessions_main_body_part_check
  check (
    main_body_part is null or main_body_part in (
      'chest','back','legs','shoulders','arms','triceps',
      'core','cardio','full_body','other'
    )
  );

alter table workout_exercises
  drop constraint if exists workout_exercises_body_part_check;
alter table workout_exercises
  add constraint workout_exercises_body_part_check
  check (
    body_part in (
      'chest','back','legs','shoulders','arms','triceps',
      'core','cardio','full_body','other'
    )
  );

alter table workout_routines
  drop constraint if exists workout_routines_main_body_part_check;
alter table workout_routines
  add constraint workout_routines_main_body_part_check
  check (
    main_body_part is null or main_body_part in (
      'chest','back','legs','shoulders','arms','triceps',
      'core','cardio','full_body','other'
    )
  );

alter table workout_routine_exercises
  drop constraint if exists workout_routine_exercises_body_part_check;
alter table workout_routine_exercises
  add constraint workout_routine_exercises_body_part_check
  check (
    body_part in (
      'chest','back','legs','shoulders','arms','triceps',
      'core','cardio','full_body','other'
    )
  );
