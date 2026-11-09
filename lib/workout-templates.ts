import { BODY_PART_LABELS, type BodyPart, type WorkoutSessionDetail } from '@/lib/types';

export interface WorkoutTemplate {
  key: string;
  label: string;
  session: WorkoutSessionDetail;
}

const SPLIT_ORDER: BodyPart[] = [
  'chest',
  'triceps',
  'back',
  'arms',
  'shoulders',
  'legs',
  'core',
  'cardio',
  'full_body',
  'other',
];

/** 部位の組み合わせ（胸+三頭など）ごとに、最新のセッションを1件ずつ返す */
export function buildSplitTemplates(
  sessions: WorkoutSessionDetail[],
): WorkoutTemplate[] {
  const templates = new Map<string, WorkoutTemplate>();

  for (const session of sessions) {
    const parts = Array.from(
      new Set(session.exercises.map((exercise) => exercise.body_part)),
    ).sort((a, b) => SPLIT_ORDER.indexOf(a) - SPLIT_ORDER.indexOf(b));
    if (parts.length === 0) continue;

    const key = parts.join('|');
    const label = splitLabel(parts);
    // 部位の組み合わせが微妙に違っても表示名が同じなら、最新の1件だけ残す
    const dupLabel = Array.from(templates.values()).some((t) => t.label === label);
    if (!templates.has(key) && !dupLabel) {
      templates.set(key, { key, label, session });
    }
  }

  return Array.from(templates.values()).slice(0, 8);
}

export function splitLabel(parts: BodyPart[]): string {
  const has = (part: BodyPart) => parts.includes(part);
  if (has('chest') && has('triceps')) return '胸 + 三頭';
  if (has('back') && has('arms')) return '背中 + 二頭・前腕';
  if (has('shoulders') && has('arms')) return '肩 + 二頭・前腕';
  if (has('shoulders') && has('triceps')) return '肩 + 三頭';
  if (has('legs')) return '脚';
  if (has('core')) return '腹筋';
  if (has('chest')) return has('arms') ? '胸 + 腕' : '胸';
  if (has('back')) return '背中';
  if (has('shoulders')) return '肩';
  if (has('triceps')) return '三頭';
  if (has('arms')) return '二頭・前腕';
  return parts.map((part) => BODY_PART_LABELS[part]).join(' + ');
}
