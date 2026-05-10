'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  deleteResearchAction,
  toggleFavoriteAction,
} from '@/app/actions/research';
import MarkdownLite from '@/components/ai/MarkdownLite';
import {
  RESEARCH_PRESET_TOPICS,
  type ResearchArticle,
} from '@/lib/types';

interface Props {
  history: ResearchArticle[];
}

export default function ResearchPanel({ history }: Props) {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [focus, setFocus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchArticle | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const submit = async (presetTopic?: string) => {
    const t = (presetTopic ?? topic).trim();
    if (!t) {
      setError('トピックを入力してください');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t, focus: focus.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'エラーが発生しました');
      } else {
        setResult(json);
        if (presetTopic) setTopic(presetTopic);
        router.refresh();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleFavorite = (id: string) => {
    setPendingId(id);
    startTransition(async () => {
      await toggleFavoriteAction(id);
      setPendingId(null);
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('このリサーチ結果を削除しますか？')) return;
    setPendingId(id);
    startTransition(async () => {
      await deleteResearchAction(id);
      setPendingId(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* プリセット トピック */}
      <div>
        <label className="block text-sm font-medium mb-2">
          プリセット（タップで即検索）
        </label>
        <div className="flex flex-wrap gap-2">
          {RESEARCH_PRESET_TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => submit(t)}
              disabled={loading}
              className="px-3 h-9 rounded-full border border-gray-300 bg-white text-xs hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 自由入力 */}
      <div>
        <label className="block text-sm font-medium mb-1">
          自由入力（トピック）
        </label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="例: クレアチン摂取量、HMBの効果"
          maxLength={80}
          className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">
          特に知りたいこと
          <span className="text-gray-500 ml-1 text-xs">(任意)</span>
        </label>
        <input
          type="text"
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="例: 減量中の安全性、年齢による違い"
          maxLength={200}
          className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white"
        />
      </div>
      <button
        onClick={() => submit()}
        disabled={loading || !topic.trim()}
        className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl"
      >
        {loading ? '🔍 検索中...' : '🔍 文献を検索'}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {/* 結果表示 */}
      {result && (
        <ResultCard
          item={result}
          onFavorite={handleFavorite}
          onDelete={handleDelete}
          pendingId={pendingId}
          highlight
        />
      )}

      {/* 履歴 */}
      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            過去のリサーチ ({history.length}件)
          </h2>
          <div className="space-y-3">
            {history.map((item) => (
              <ResultCard
                key={item.id}
                item={item}
                onFavorite={handleFavorite}
                onDelete={handleDelete}
                pendingId={pendingId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultCard({
  item,
  onFavorite,
  onDelete,
  pendingId,
  highlight = false,
}: {
  item: ResearchArticle & { cached?: boolean };
  onFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  pendingId: string | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold truncate">📚 {item.topic}</div>
          {item.focus && (
            <div className="text-xs text-gray-600 mt-0.5 truncate">
              フォーカス: {item.focus}
            </div>
          )}
          <div className="text-[10px] text-gray-400 mt-1">
            {item.created_at?.slice(0, 10)}
            {item.cached && ' (キャッシュ)'}
            {item.is_favorite && ' ⭐'}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onFavorite(item.id)}
            disabled={pendingId === item.id}
            className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            {item.is_favorite ? '⭐ 解除' : '☆ 保存'}
          </button>
          <button
            onClick={() => onDelete(item.id)}
            disabled={pendingId === item.id}
            className="text-xs px-2 py-1 rounded border border-rose-300 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          >
            削除
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-800 leading-relaxed break-words overflow-hidden">
        <MarkdownLite text={item.summary} />
      </div>

      {item.citations.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-blue-600 hover:underline">
            🔗 引用元 ({item.citations.length}件)
          </summary>
          <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
            {item.citations.map((c, i) => (
              <li key={i} className="break-words">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {c.title || c.url}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
