import type { FormulaResult } from '@/lib/calculations';

interface Props {
  result: FormulaResult;
}

export default function MacroChart({ result }: Props) {
  const pKcal = result.protein_g * 4;
  const fKcal = result.fat_g * 9;
  const cKcal = result.carbs_g * 4;
  const total = Math.max(1, pKcal + fKcal + cKcal);
  const pct = (n: number) => Math.round((n / total) * 100);

  return (
    <div className="space-y-3">
      <div className="flex h-8 rounded-lg overflow-hidden border border-gray-200">
        <div
          className="bg-rose-500 flex items-center justify-center text-xs text-white font-semibold"
          style={{ width: `${pct(pKcal)}%` }}
          title={`タンパク質 ${pct(pKcal)}%`}
        >
          {pct(pKcal) >= 8 ? `P ${pct(pKcal)}%` : ''}
        </div>
        <div
          className="bg-amber-500 flex items-center justify-center text-xs text-white font-semibold"
          style={{ width: `${pct(fKcal)}%` }}
          title={`脂質 ${pct(fKcal)}%`}
        >
          {pct(fKcal) >= 8 ? `F ${pct(fKcal)}%` : ''}
        </div>
        <div
          className="bg-emerald-500 flex items-center justify-center text-xs text-white font-semibold"
          style={{ width: `${pct(cKcal)}%` }}
          title={`炭水化物 ${pct(cKcal)}%`}
        >
          {pct(cKcal) >= 8 ? `C ${pct(cKcal)}%` : ''}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Cell color="bg-rose-500" label="P (タンパク質)" g={result.protein_g} kcal={pKcal} />
        <Cell color="bg-amber-500" label="F (脂質)" g={result.fat_g} kcal={fKcal} />
        <Cell color="bg-emerald-500" label="C (炭水化物)" g={result.carbs_g} kcal={cKcal} />
      </div>
    </div>
  );
}

function Cell({
  color,
  label,
  g,
  kcal,
}: {
  color: string;
  label: string;
  g: number;
  kcal: number;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-2">
      <div className="flex items-center gap-1 mb-1">
        <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
        <span className="text-gray-600">{label}</span>
      </div>
      <div className="font-semibold text-gray-900 tabular-nums">{g}g</div>
      <div className="text-gray-500 tabular-nums">{Math.round(kcal)} kcal</div>
    </div>
  );
}
