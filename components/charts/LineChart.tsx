/**
 * 軽量SVGラインチャート（依存ライブラリなし）。
 * 複数系列対応。Y軸自動スケール、X軸は日付ラベル。
 * モバイル幅にレスポンシブ対応。
 */

interface Series {
  label: string;
  color: string;
  /** [x:number, y:number] 配列。x は serial（日数など）。 */
  points: Array<{ x: number; y: number; label?: string }>;
  /** 点線にする場合 */
  dashed?: boolean;
  /** 点を描画するか */
  showDots?: boolean;
}

interface Props {
  series: Series[];
  /** xLabels: x の値 → 表示ラベル */
  xLabels?: { x: number; label: string }[];
  yUnit?: string;
  height?: number;
  /** Y軸最小値を強制したい場合 */
  yMin?: number;
  yMax?: number;
}

export default function LineChart({
  series,
  xLabels,
  yUnit = '',
  height = 220,
  yMin: yMinProp,
  yMax: yMaxProp,
}: Props) {
  // SVG viewBox は 600x{height} 固定で、CSS で width:100% にする
  const W = 600;
  const H = height;
  const PAD_L = 44;
  const PAD_R = 12;
  const PAD_T = 10;
  const PAD_B = 28;

  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-sm text-gray-400">
        データがありません
      </div>
    );
  }

  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  let minY = yMinProp !== undefined ? yMinProp : Math.min(...ys);
  let maxY = yMaxProp !== undefined ? yMaxProp : Math.max(...ys);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  // Y軸に少し余裕を持たせる
  const yPad = (maxY - minY) * 0.08;
  minY -= yPad;
  maxY += yPad;

  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  const sx = (x: number) =>
    PAD_L + ((x - minX) / xRange) * (W - PAD_L - PAD_R);
  const sy = (y: number) =>
    PAD_T + (1 - (y - minY) / yRange) * (H - PAD_T - PAD_B);

  // Y軸目盛り（5本）
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const v = minY + (yRange * i) / 4;
    return v;
  });

  return (
    <div className="sport-card p-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        preserveAspectRatio="none"
        className="block"
      >
        {/* Y軸グリッド & ラベル */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={sy(v)}
              y2={sy(v)}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 4}
              y={sy(v) + 4}
              textAnchor="end"
              fontSize="10"
              fill="#93a4b8"
            >
              {Math.round(v * 10) / 10}
              {yUnit}
            </text>
          </g>
        ))}

        {/* X軸ラベル */}
        {xLabels?.map((tick) => (
          <text
            key={tick.x}
            x={sx(tick.x)}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            fill="#93a4b8"
          >
            {tick.label}
          </text>
        ))}

        {/* 系列ごとにライン描画 */}
        {series.map((s, i) => {
          const pts = s.points
            .slice()
            .sort((a, b) => a.x - b.x);
          if (pts.length === 0) return null;
          const path = pts
            .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${sx(p.x)},${sy(p.y)}`)
            .join(' ');
          return (
            <g key={i}>
              <path
                d={path}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? '4 3' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {s.showDots !== false &&
                pts.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={sx(p.x)}
                    cy={sy(p.y)}
                    r={2.5}
                    fill={s.color}
                  />
                ))}
            </g>
          );
        })}
      </svg>

      {/* 凡例 */}
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-600">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: s.color }}
            />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
