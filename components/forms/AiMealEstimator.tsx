'use client';

import { useRef, useState } from 'react';
import type { MealType } from '@/lib/types';

export interface AiEstimate {
  food_name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  meal_type: MealType | null;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
  items?: string[];
}

interface Props {
  onApply: (e: AiEstimate) => void;
}

type Mode = 'text' | 'image';

type PhotoStatus = 'pending' | 'loading' | 'done' | 'error';

interface PhotoEntry {
  id: string;
  file: File;
  previewUrl: string;
  status: PhotoStatus;
  result?: AiEstimate;
  error?: string;
}

const MAX_PHOTOS = 8;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 元ファイルは大きくてもOK（送信前にクライアント側で圧縮）
const ACCEPT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  '', // iOSではmime空で来ることがあるため受け入れて拡張子でフォールバック判定
]);
const ACCEPT_EXT_RE = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

export default function AiMealEstimator({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  const [textResult, setTextResult] = useState<AiEstimate | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [entries, setEntries] = useState<PhotoEntry[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText('');
    setTextResult(null);
    setEntries((prev) => {
      prev.forEach((e) => URL.revokeObjectURL(e.previewUrl));
      return [];
    });
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 300);
  };

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const incoming = Array.from(files);
    setEntries((prev) => {
      const remainingSlots = Math.max(0, MAX_PHOTOS - prev.length);
      if (remainingSlots === 0) {
        setError(`画像は最大${MAX_PHOTOS}枚までです`);
        return prev;
      }
      const accepted: PhotoEntry[] = [];
      const rejected: string[] = [];
      for (const f of incoming.slice(0, remainingSlots)) {
        const okByMime = ACCEPT_TYPES.has(f.type);
        const okByExt = ACCEPT_EXT_RE.test(f.name);
        if (!okByMime && !okByExt) {
          rejected.push(`${f.name}: 非対応の形式`);
          continue;
        }
        if (f.size > MAX_FILE_BYTES) {
          rejected.push(`${f.name}: ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB超`);
          continue;
        }
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file: f,
          previewUrl: URL.createObjectURL(f),
          status: 'pending',
        });
      }
      if (incoming.length > remainingSlots) {
        rejected.push(`残り${remainingSlots}枚を超える分は追加しませんでした`);
      }
      if (rejected.length > 0) setError(rejected.join(' / '));
      return [...prev, ...accepted];
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => {
      const target = prev.find((e) => e.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((e) => e.id !== id);
    });
  };

  const handleTextSubmit = async () => {
    if (!text.trim()) {
      setError('食事内容を入力してください');
      return;
    }
    setTextLoading(true);
    setError(null);
    setTextResult(null);
    try {
      const res = await fetch('/api/meal/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `エラー: ${res.status}`);
      } else {
        setTextResult(json.result);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTextLoading(false);
    }
  };

  const recognizeOne = async (file: File): Promise<AiEstimate> => {
    const prepared = await prepareForUpload(file);
    const fd = new FormData();
    fd.append('image', prepared);
    let res: Response;
    try {
      res = await fetch('/api/meal/recognize', {
        method: 'POST',
        body: fd,
      });
    } catch {
      throw new RecognizeError(
        '通信エラーが発生しました。電波状況を確認して再試行してください',
        0,
      );
    }
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) {
      if (res.status === 413) {
        throw new RecognizeError(
          '画像サイズが大きすぎます（縮小に失敗）',
          413,
        );
      }
      throw new RecognizeError(
        `サーバエラー（HTTP ${res.status}）。少し経ってから再試行してください`,
        res.status,
      );
    }
    let json: { result?: AiEstimate; error?: string };
    try {
      json = await res.json();
    } catch {
      throw new RecognizeError('サーバ応答を解析できませんでした', res.status);
    }
    if (!res.ok) {
      throw new RecognizeError(
        friendlyServerError(json.error, res.status),
        res.status,
      );
    }
    if (!json.result) {
      throw new RecognizeError('AIの応答に結果が含まれていません', res.status);
    }
    return json.result;
  };

  const recognizeWithRetry = async (
    file: File,
    onAttempt?: (attempt: number, waitMs: number) => void,
  ): Promise<AiEstimate> => {
    const MAX_ATTEMPTS = 4;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await recognizeOne(file);
      } catch (err) {
        lastErr = err;
        const isRateLimit =
          err instanceof RecognizeError &&
          (err.status === 429 || /利用上限|quota|exceeded|429/i.test(err.message));
        if (!isRateLimit || attempt === MAX_ATTEMPTS) throw err;
        const waitMs = 1500 * Math.pow(2, attempt - 1); // 1.5s, 3s, 6s
        onAttempt?.(attempt, waitMs);
        await sleep(waitMs);
      }
    }
    throw lastErr;
  };

  const handleImageSubmit = async () => {
    const targets = entries.filter(
      (e) => e.status === 'pending' || e.status === 'error',
    );
    if (targets.length === 0) {
      if (entries.length === 0) {
        setError('画像を追加してください');
      }
      return;
    }
    setImageLoading(true);
    setError(null);
    setEntries((prev) =>
      prev.map((e) =>
        targets.some((t) => t.id === e.id)
          ? { ...e, status: 'loading', error: undefined }
          : e,
      ),
    );

    // Gemini API のレート制限（典型的に 15 RPM）を避けるため逐次処理
    for (const t of targets) {
      try {
        const r = await recognizeWithRetry(t.file);
        setEntries((prev) =>
          prev.map((e) =>
            e.id === t.id ? { ...e, status: 'done', result: r } : e,
          ),
        );
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : '不明なエラー';
        setEntries((prev) =>
          prev.map((e) =>
            e.id === t.id ? { ...e, status: 'error', error: msg } : e,
          ),
        );
      }
    }

    setImageLoading(false);
  };

  const totals = computeTotals(entries);

  const handleApplyText = () => {
    if (!textResult) return;
    onApply(textResult);
    close();
  };

  const handleApplyImageTotals = () => {
    if (!totals) return;
    onApply(totals);
    close();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full h-11 rounded-xl border border-purple-300 bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100"
      >
        ✨ AIで推定する（テキスト / 写真）
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={close}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-xl pb-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
              <h3 className="text-base font-semibold">AIで栄養を推定</h3>
              <button
                type="button"
                onClick={close}
                className="text-gray-500 text-2xl leading-none px-2"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            {/* モード切替 */}
            <div className="px-4 pt-3 pb-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('text');
                    setError(null);
                  }}
                  className={`h-11 rounded-xl border text-sm font-medium ${
                    mode === 'text'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white border-gray-300 text-gray-700'
                  }`}
                >
                  📝 テキストで入力
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('image');
                    setError(null);
                  }}
                  className={`h-11 rounded-xl border text-sm font-medium ${
                    mode === 'image'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white border-gray-300 text-gray-700'
                  }`}
                >
                  📷 写真から判定
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4">
              {mode === 'text' ? (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    例：「鶏むね肉100gと玄米茶碗1杯と納豆1パック」
                    「マクドナルドのビッグマックセット」「プロテインシェイク 30g」
                  </p>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                    placeholder="食べたものを自由に書いてください"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-base"
                    maxLength={1000}
                  />
                  <button
                    type="button"
                    onClick={handleTextSubmit}
                    disabled={textLoading || !text.trim()}
                    className="w-full h-11 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold rounded-xl"
                  >
                    {textLoading ? '🤖 推定中...' : '推定する'}
                  </button>

                  {textResult && (
                    <ResultCard
                      title="✨ 推定結果"
                      estimate={textResult}
                      onApply={handleApplyText}
                    />
                  )}
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    複数の食事写真をアップロード／撮影できます。各画像をAIが個別に判定し、合計カロリー・PFCを算出します
                    （最大{MAX_PHOTOS}枚 / 大きな画像は自動で縮小して送信されます）
                  </p>

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/*"
                    multiple
                    ref={fileInputRef}
                    onChange={(e) => addFiles(e.target.files)}
                    className="hidden"
                  />

                  {entries.length > 0 && (
                    <ul className="space-y-2">
                      {entries.map((entry, idx) => (
                        <li
                          key={entry.id}
                          className="flex gap-3 items-start bg-white border border-gray-200 rounded-xl p-2"
                        >
                          <div className="relative shrink-0">
                            <img
                              src={entry.previewUrl}
                              alt={`写真${idx + 1}`}
                              className="w-20 h-20 object-cover rounded-lg bg-gray-100"
                            />
                            <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 rounded-full">
                              #{idx + 1}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <PhotoStatusLine entry={entry} />
                              <button
                                type="button"
                                onClick={() => removeEntry(entry.id)}
                                className="text-gray-400 hover:text-gray-700 text-lg leading-none"
                                aria-label="削除"
                              >
                                ×
                              </button>
                            </div>
                            {entry.status === 'done' && entry.result && (
                              <div className="mt-1 text-xs text-gray-700 space-y-0.5">
                                <div className="font-medium truncate">
                                  {entry.result.food_name || '(料理名未推定)'}
                                </div>
                                <div className="tabular-nums">
                                  {Math.round(entry.result.calories)} kcal /
                                  P{fmt(entry.result.protein_g)}g
                                  F{fmt(entry.result.fat_g)}g
                                  C{fmt(entry.result.carbs_g)}g
                                </div>
                              </div>
                            )}
                            {entry.status === 'error' && entry.error && (
                              <div className="mt-1 text-xs text-red-600 line-clamp-2">
                                {entry.error}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={entries.length >= MAX_PHOTOS}
                    className={`w-full rounded-xl border-2 border-dashed text-sm flex flex-col items-center justify-center ${
                      entries.length === 0 ? 'h-32' : 'h-20'
                    } ${
                      entries.length >= MAX_PHOTOS
                        ? 'border-gray-200 bg-gray-50 text-gray-400'
                        : 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100'
                    }`}
                  >
                    <span className="text-2xl">🖼</span>
                    <span className="font-medium">
                      {entries.length === 0
                        ? 'タップして写真を選択 / 撮影'
                        : entries.length >= MAX_PHOTOS
                          ? `最大${MAX_PHOTOS}枚に達しました`
                          : `+ 写真を追加（${entries.length}/${MAX_PHOTOS}）`}
                    </span>
                    {entries.length === 0 && (
                      <span className="text-[10px] text-purple-600/80 mt-0.5">
                        複数選択可（アルバム or カメラ）
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleImageSubmit}
                    disabled={
                      imageLoading ||
                      entries.length === 0 ||
                      entries.every((e) => e.status === 'done')
                    }
                    className="w-full h-11 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold rounded-xl"
                  >
                    {imageLoading
                      ? '🤖 認識中...'
                      : entries.every((e) => e.status === 'done') &&
                          entries.length > 0
                        ? '判定済み'
                        : `判定する${
                            entries.filter(
                              (e) =>
                                e.status === 'pending' || e.status === 'error',
                            ).length > 0
                              ? `（${entries.filter((e) => e.status === 'pending' || e.status === 'error').length}枚）`
                              : ''
                          }`}
                  </button>

                  {totals && (
                    <ResultCard
                      title={`🧮 合計（${entries.filter((e) => e.status === 'done').length}枚分）`}
                      estimate={totals}
                      onApply={handleApplyImageTotals}
                      applyLabel="この合計をフォームに反映する"
                    />
                  )}
                </div>
              )}

              {error && (
                <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function PhotoStatusLine({ entry }: { entry: PhotoEntry }) {
  if (entry.status === 'pending') {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
        未判定
      </span>
    );
  }
  if (entry.status === 'loading') {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
        🤖 判定中...
      </span>
    );
  }
  if (entry.status === 'error') {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        エラー
      </span>
    );
  }
  // done
  return entry.result ? (
    <ConfidenceBadge level={entry.result.confidence} />
  ) : null;
}

function ResultCard({
  title,
  estimate,
  onApply,
  applyLabel = 'この値をフォームに反映する',
}: {
  title: string;
  estimate: AiEstimate;
  onApply: () => void;
  applyLabel?: string;
}) {
  return (
    <div className="mt-4 bg-purple-50 border border-purple-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-purple-800">{title}</div>
        <ConfidenceBadge level={estimate.confidence} />
      </div>
      <div className="font-semibold text-base mb-1">
        {estimate.food_name || '(料理名未推定)'}
      </div>
      {estimate.items && estimate.items.length > 0 && (
        <div className="text-xs text-gray-600 mb-2">
          含まれる項目: {estimate.items.join(' / ')}
        </div>
      )}
      <div className="text-2xl font-bold tabular-nums">
        {Math.round(estimate.calories)} kcal
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs">
        <div className="bg-rose-50 rounded p-1.5">
          <div className="text-rose-600">P</div>
          <div className="font-semibold tabular-nums">
            {fmt(estimate.protein_g)}g
          </div>
        </div>
        <div className="bg-amber-50 rounded p-1.5">
          <div className="text-amber-600">F</div>
          <div className="font-semibold tabular-nums">
            {fmt(estimate.fat_g)}g
          </div>
        </div>
        <div className="bg-emerald-50 rounded p-1.5">
          <div className="text-emerald-600">C</div>
          <div className="font-semibold tabular-nums">
            {fmt(estimate.carbs_g)}g
          </div>
        </div>
      </div>
      {estimate.notes && (
        <div className="text-xs text-gray-600 mt-2 leading-relaxed">
          💬 {estimate.notes}
        </div>
      )}
      <button
        type="button"
        onClick={onApply}
        className="w-full mt-3 h-11 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl"
      >
        {applyLabel}
      </button>
      <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
        ※ AIの推定値は目安です。市販品のラベル等を確認の上、必要に応じて編集してください。
      </p>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const labels = {
    high: { text: '信頼度: 高', cls: 'bg-emerald-100 text-emerald-700' },
    medium: { text: '信頼度: 中', cls: 'bg-amber-100 text-amber-700' },
    low: { text: '信頼度: 低', cls: 'bg-rose-100 text-rose-700' },
  };
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${labels[level].cls}`}
    >
      {labels[level].text}
    </span>
  );
}

function computeTotals(entries: PhotoEntry[]): AiEstimate | null {
  const done = entries.filter(
    (e): e is PhotoEntry & { result: AiEstimate } =>
      e.status === 'done' && !!e.result,
  );
  if (done.length === 0) return null;

  let calories = 0;
  let protein = 0;
  let fat = 0;
  let carbs = 0;
  const names: string[] = [];
  const items: string[] = [];
  const notes: string[] = [];
  const mealTypeVotes: Record<string, number> = {};
  const confidenceRank: Record<AiEstimate['confidence'], number> = {
    high: 3,
    medium: 2,
    low: 1,
  };
  let worstConfidence: AiEstimate['confidence'] = 'high';

  for (const { result } of done) {
    calories += result.calories;
    protein += result.protein_g;
    fat += result.fat_g;
    carbs += result.carbs_g;
    if (result.food_name) names.push(result.food_name);
    if (Array.isArray(result.items)) items.push(...result.items);
    if (result.notes) notes.push(result.notes);
    if (result.meal_type) {
      mealTypeVotes[result.meal_type] =
        (mealTypeVotes[result.meal_type] ?? 0) + 1;
    }
    if (confidenceRank[result.confidence] < confidenceRank[worstConfidence]) {
      worstConfidence = result.confidence;
    }
  }

  const meal_type =
    (Object.entries(mealTypeVotes).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0] as MealType | undefined) ?? null;

  const uniqueItems = Array.from(new Set(items)).slice(0, 30);

  return {
    food_name:
      names.length === 0
        ? `写真${done.length}枚の合計`
        : names.length === 1
          ? names[0]
          : `${names.slice(0, 2).join(' + ')}${names.length > 2 ? ` ほか${names.length - 2}件` : ''}`,
    calories: round1(calories),
    protein_g: round1(protein),
    fat_g: round1(fat),
    carbs_g: round1(carbs),
    meal_type,
    confidence: worstConfidence,
    notes:
      done.length === 1
        ? notes[0] ?? ''
        : `写真${done.length}枚の合計値です。${notes.length > 0 ? notes[0] : ''}`.slice(
            0,
            300,
          ),
    items: uniqueItems.length > 0 ? uniqueItems : undefined,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(round1(n));
}

class RecognizeError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'RecognizeError';
  }
}

function friendlyServerError(
  raw: string | undefined,
  status: number,
): string {
  if (status === 429 || (raw && /429|quota|exceeded|rate/i.test(raw))) {
    return 'AIの利用上限に達しました。少し時間を置いて再試行してください';
  }
  if (!raw) return `エラー: ${status}`;
  // JSON 風のダンプはユーザーには出さない
  if (raw.includes('"code"') || raw.includes('"message"')) {
    return `画像認識に失敗しました（HTTP ${status}）`;
  }
  return raw.length > 120 ? raw.slice(0, 120) + '...' : raw;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const UPLOAD_MAX_DIM = 1600;
const UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
const VERCEL_BODY_LIMIT = 4 * 1024 * 1024;

async function prepareForUpload(file: File): Promise<File> {
  // 元ファイルが小さく、かつ既に対応MIMEならそのまま返す
  if (
    file.size <= UPLOAD_MAX_BYTES &&
    /^image\/(jpeg|png|webp|gif)$/.test(file.type)
  ) {
    return file;
  }
  try {
    return await compressImage(file);
  } catch {
    // 圧縮失敗時：元ファイルが Vercel 上限以内かつ対応MIMEなら fallback で送る
    if (
      file.size <= VERCEL_BODY_LIMIT &&
      /^image\/(jpeg|png|webp|gif)$/.test(file.type)
    ) {
      return file;
    }
    throw new Error('画像の前処理に失敗しました。別の写真でお試しください');
  }
}

async function compressImage(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { width, height } = scaleDown(img.width, img.height, UPLOAD_MAX_DIM);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.85;
    let blob = await canvasToBlob(canvas, quality);
    while (blob.size > UPLOAD_MAX_BYTES && quality > 0.45) {
      quality -= 0.1;
      blob = await canvasToBlob(canvas, quality);
    }
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = src;
  });
}

function scaleDown(
  w: number,
  h: number,
  maxDim: number,
): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= maxDim) return { width: w, height: h };
  const ratio = maxDim / longest;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error('canvas.toBlob returned null')),
      'image/jpeg',
      quality,
    );
  });
}
