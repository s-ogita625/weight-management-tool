import { Coffee, Droplets, GlassWater } from 'lucide-react';

export interface HydrationTotals {
  total: number;
  water: number;
  protein: number;
  coffee: number;
  other: number;
}

interface Props {
  total: HydrationTotals;
  count: number;
}

export default function HydrationSummary({ total, count }: Props) {
  return (
    <section className="sport-card-strong p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="sport-kicker">Today hydration</div>
          <h2 className="mt-1 text-lg font-black">本日の水分補給</h2>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/25 text-[#20e0ff] ring-1 ring-white/10">
          <Droplets size={21} />
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-4xl font-black tabular-nums text-white">
            {(total.total / 1000).toFixed(1)}
            <span className="ml-1 text-base text-slate-400">L</span>
          </div>
          <div className="text-xs font-semibold text-slate-400">
            {total.total.toLocaleString()}ml / {count}件
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-right">
          <div className="text-[10px] font-semibold text-slate-500">
            カフェイン系
          </div>
          <div className="text-sm font-black tabular-nums text-amber-200">
            {total.coffee.toLocaleString()}ml
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <HydrationMiniMetric
          icon={Droplets}
          label="水"
          value={`${total.water.toLocaleString()}ml`}
          tone="water"
        />
        <HydrationMiniMetric
          icon={GlassWater}
          label="プロテイン"
          value={`${total.protein.toLocaleString()}ml`}
          tone="protein"
        />
        <HydrationMiniMetric
          icon={Coffee}
          label="その他"
          value={`${(total.coffee + total.other).toLocaleString()}ml`}
          tone="other"
        />
      </div>
    </section>
  );
}

function HydrationMiniMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Droplets;
  label: string;
  value: string;
  tone: 'water' | 'protein' | 'other';
}) {
  const toneClass =
    tone === 'water'
      ? 'text-[#7af7ff]'
      : tone === 'protein'
        ? 'text-[#a3ff12]'
        : 'text-amber-200';
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-2">
      <Icon size={16} className={toneClass} />
      <div className="mt-1 text-[10px] font-semibold text-slate-500">
        {label}
      </div>
      <div className={`text-sm font-black tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

