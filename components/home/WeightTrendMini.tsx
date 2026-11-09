import Link from 'next/link';
import LineChart from '@/components/charts/LineChart';
import { daysBetween } from '@/lib/stats';

export interface WeightPoint {
  date: string;
  weight: number;
  ma7: number;
}

/** ホーム用：直近の体重（薄い点）と7日移動平均（太線） */
export default function WeightTrendMini({
  points,
  targetWeight,
}: {
  points: WeightPoint[];
  targetWeight: number;
}) {
  if (points.length < 2) return null;
  const origin = points[0].date;
  const x = (d: string) => daysBetween(origin, d);
  const step = Math.max(1, Math.ceil(points.length / 5));
  const xLabels = points
    .filter((_, i) => i % step === 0 || i === points.length - 1)
    .map((p) => ({ x: x(p.date), label: p.date.slice(5).replace('-', '/') }));
  const values = points.flatMap((p) => [p.weight, p.ma7]);
  const yMin = Math.floor(Math.min(...values) - 0.5);
  const yMax = Math.ceil(Math.max(...values) + 0.5);

  return (
    <Link href="/trend" className="sport-card block p-3">
      <div className="mb-1 flex items-center justify-between px-1 text-xs">
        <span className="font-bold text-slate-200">体重の推移</span>
        <span className="text-[10px] text-slate-400">目標 {targetWeight.toFixed(1)}kg</span>
      </div>
      <LineChart
        height={150}
        yUnit="kg"
        yMin={yMin}
        yMax={yMax}
        xLabels={xLabels}
        series={[
          {
            label: '毎日',
            color: '#64748b',
            showDots: true,
            dashed: true,
            points: points.map((p) => ({ x: x(p.date), y: p.weight })),
          },
          {
            label: '7日平均',
            color: '#a3ff12',
            points: points.map((p) => ({ x: x(p.date), y: p.ma7 })),
          },
        ]}
      />
    </Link>
  );
}
