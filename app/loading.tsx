/**
 * 画面遷移中にすぐ表示する骨組み（タップ直後に反応を返すため）。
 * データの取得が終わると本来の画面に置き換わる。
 */
export default function Loading() {
  return (
    <div className="space-y-4 py-4" aria-busy="true" aria-label="読み込み中">
      <div className="h-36 animate-pulse rounded-lg border border-white/10 bg-white/[0.05]" />
      <div className="h-24 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]" />
      <div className="h-48 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]" />
      <div className="h-24 animate-pulse rounded-lg border border-white/10 bg-white/[0.03]" />
    </div>
  );
}
