import type { CalcOutput } from '@/lib/calculations';

interface Props {
  result: CalcOutput;
}

export default function ComparisonTable({ result }: Props) {
  const rows = [
    { label: 'BMR (基礎代謝)', m: result.mifflin.bmr, k: result.katchMcArdle.bmr, unit: 'kcal' },
    { label: 'TDEE (総消費)', m: result.mifflin.tdee, k: result.katchMcArdle.tdee, unit: 'kcal' },
    {
      label: '目標摂取カロリー',
      m: result.mifflin.targetCalories,
      k: result.katchMcArdle.targetCalories,
      unit: 'kcal',
      highlight: true,
    },
    { label: 'タンパク質', m: result.mifflin.protein_g, k: result.katchMcArdle.protein_g, unit: 'g' },
    { label: '脂質', m: result.mifflin.fat_g, k: result.katchMcArdle.fat_g, unit: 'g' },
    { label: '炭水化物', m: result.mifflin.carbs_g, k: result.katchMcArdle.carbs_g, unit: 'g' },
  ];
  const recM = result.recommendedFormula === 'mifflin';
  const recK = result.recommendedFormula === 'katchMcArdle';

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full overflow-hidden rounded-lg border border-white/10 bg-[#10151f] text-sm">
        <thead>
          <tr className="bg-white/[0.045]">
            <th className="text-left p-3 font-medium text-gray-700">項目</th>
            <th
              className={`p-3 font-medium text-right ${
                recM ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              Mifflin{recM && ' ★'}
            </th>
            <th
              className={`p-3 font-medium text-right ${
                recK ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              Katch-McArdle{recK && ' ★'}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.label}
              className={`border-t border-white/10 ${r.highlight ? 'bg-[#a3ff12]/10' : ''}`}
            >
              <td className="p-3 text-gray-700">{r.label}</td>
              <td
                className={`p-3 text-right tabular-nums font-semibold ${
                  recM ? 'bg-blue-50/40' : ''
                }`}
              >
                {r.m.toLocaleString()} <span className="text-xs text-gray-500">{r.unit}</span>
              </td>
              <td
                className={`p-3 text-right tabular-nums font-semibold ${
                  recK ? 'bg-blue-50/40' : ''
                }`}
              >
                {r.k.toLocaleString()} <span className="text-xs text-gray-500">{r.unit}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500 mt-2">★ = 推奨式（あなたのデータに最適）</p>
    </div>
  );
}
