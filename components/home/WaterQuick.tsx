'use client';

import { Droplets } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { quickAddWaterAction } from '@/app/actions/quick';
import { nowAt, sendOrQueue } from '@/lib/offline-queue';

export default function WaterQuick({ totalMl }: { totalMl: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const add = (ml: number) =>
    startTransition(async () => {
      const res = await sendOrQueue({ kind: 'water', ml, at: nowAt() }, () =>
        quickAddWaterAction(ml),
      );
      if (res.status === 'sent') router.refresh();
    });

  return (
    <section className="sport-card flex items-center gap-3 p-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/25 text-[#20e0ff] ring-1 ring-white/10">
          <Droplets size={17} />
        </span>
        <span>
          <span className="block text-[11px] text-slate-400">水分</span>
          <span className="block text-base font-black tabular-nums text-[#20e0ff]">
            {(totalMl / 1000).toFixed(1)}L
          </span>
        </span>
      </div>
      {[200, 500].map((ml) => (
        <button
          key={ml}
          type="button"
          disabled={pending}
          onClick={() => add(ml)}
          className="h-11 rounded-lg border border-[#20e0ff]/40 bg-[#20e0ff]/10 px-3 text-xs font-bold text-[#20e0ff] active:scale-95 disabled:opacity-60"
        >
          +{ml}ml
        </button>
      ))}
    </section>
  );
}
