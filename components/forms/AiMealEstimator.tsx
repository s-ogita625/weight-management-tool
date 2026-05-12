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

export default function AiMealEstimator({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiEstimate | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText('');
    setImageFile(null);
    setImagePreview(null);
    setError(null);
    setResult(null);
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 300);
  };

  const handleFile = (f: File | null) => {
    if (!f) {
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setImageFile(f);
    const url = URL.createObjectURL(f);
    setImagePreview(url);
    setError(null);
    setResult(null);
  };

  const handleTextSubmit = async () => {
    if (!text.trim()) {
      setError('食事内容を入力してください');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
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
        setResult(json.result);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleImageSubmit = async () => {
    if (!imageFile) {
      setError('画像を選択してください');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      const res = await fetch('/api/meal/recognize', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `エラー: ${res.status}`);
      } else {
        setResult(json.result);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApply(result);
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
                    setResult(null);
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
                    setResult(null);
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
                    disabled={loading || !text.trim()}
                    className="w-full h-11 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold rounded-xl"
                  >
                    {loading ? '🤖 推定中...' : '推定する'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    食事の写真を選ぶか撮影すると、AIが料理を識別してカロリー・PFCを推定します
                    （5MB以下、JPEG/PNG/WebP/GIF）
                  </p>

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    ref={fileInputRef}
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />

                  {imagePreview ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="プレビュー"
                          className="w-full max-h-64 object-contain bg-gray-100 rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => handleFile(null)}
                          className="absolute top-2 right-2 bg-white/90 rounded-full w-8 h-8 flex items-center justify-center shadow"
                          aria-label="画像をクリア"
                        >
                          ×
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-9 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-medium hover:bg-gray-50"
                      >
                        🔄 別の画像を選ぶ
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-32 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 text-purple-700 text-sm flex flex-col items-center justify-center hover:bg-purple-100"
                    >
                      <span className="text-3xl mb-1">🖼</span>
                      <span className="font-medium">
                        タップして写真を選択 / 撮影
                      </span>
                      <span className="text-[10px] text-purple-600/80 mt-0.5">
                        アルバムまたはカメラから選べます
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleImageSubmit}
                    disabled={loading || !imageFile}
                    className="w-full h-11 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold rounded-xl"
                  >
                    {loading ? '🤖 認識中...' : 'この画像で判定する'}
                  </button>
                </div>
              )}

              {error && (
                <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  {error}
                </div>
              )}

              {result && (
                <div className="mt-4 bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-purple-800">
                      ✨ 推定結果
                    </div>
                    <ConfidenceBadge level={result.confidence} />
                  </div>
                  <div className="font-semibold text-base mb-1">
                    {result.food_name || '(料理名未推定)'}
                  </div>
                  {result.items && result.items.length > 0 && (
                    <div className="text-xs text-gray-600 mb-2">
                      含まれる項目: {result.items.join(' / ')}
                    </div>
                  )}
                  <div className="text-2xl font-bold tabular-nums">
                    {Math.round(result.calories)} kcal
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs">
                    <div className="bg-rose-50 rounded p-1.5">
                      <div className="text-rose-600">P</div>
                      <div className="font-semibold tabular-nums">
                        {result.protein_g}g
                      </div>
                    </div>
                    <div className="bg-amber-50 rounded p-1.5">
                      <div className="text-amber-600">F</div>
                      <div className="font-semibold tabular-nums">
                        {result.fat_g}g
                      </div>
                    </div>
                    <div className="bg-emerald-50 rounded p-1.5">
                      <div className="text-emerald-600">C</div>
                      <div className="font-semibold tabular-nums">
                        {result.carbs_g}g
                      </div>
                    </div>
                  </div>
                  {result.notes && (
                    <div className="text-xs text-gray-600 mt-2 leading-relaxed">
                      💬 {result.notes}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleApply}
                    className="w-full mt-3 h-11 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl"
                  >
                    この値をフォームに反映する
                  </button>
                  <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                    ※ AIの推定値は目安です。市販品のラベル等を確認の上、必要に応じて編集してください。
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
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
