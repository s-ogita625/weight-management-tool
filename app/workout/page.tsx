import { redirect } from 'next/navigation';
import WorkoutView from '@/components/workout/WorkoutView';
import { getSessionUserId } from '@/lib/auth';
import { getWorkoutSessions, getWorkoutStats } from '@/lib/workouts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkoutPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const [sessions, stats] = await Promise.all([
    getWorkoutSessions(userId, 30),
    getWorkoutStats(userId),
  ]);

  return (
    <div className="py-4">
      <WorkoutView sessions={sessions} stats={stats} />
    </div>
  );
}
