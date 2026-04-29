'use client';

import { useEffect, useRef, useState } from 'react';
import MarkdownLite from '@/components/ai/MarkdownLite';
import type { AiChatMessage } from '@/lib/types';

interface UIMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  initial: AiChatMessage[];
}

const SUGGESTIONS = [
  '今のペースで目標達成できそうですか？',
  'タンパク質を効率よく摂る食材を5つ教えて',
  '筋トレ後に最適な食事のタイミングと内容は？',
  'チートデイは入れていい？頻度の目安は？',
  '停滞期に入った時の対処法は？',
];

export default function ChatView({ initial }: Props) {
  const [messages, setMessages] = useState<UIMessage[]>(
    initial.map((m) => ({ role: m.role, content: m.content })),
  );
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // スクロール最下部追従
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || streaming) return;
    setError(null);
    setInput('');
    setMessages((m) => [
      ...m,
      { role: 'user', content: message },
      { role: 'assistant', content: '' },
    ]);
    setStreaming(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const next = [...m];
          if (next.length > 0 && next[next.length - 1].role === 'assistant') {
            next[next.length - 1] = {
              role: 'assistant',
              content: buffer,
            };
          }
          return next;
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setMessages((m) => {
        const next = [...m];
        if (
          next.length > 0 &&
          next[next.length - 1].role === 'assistant' &&
          next[next.length - 1].content === ''
        ) {
          next.pop();
        }
        return next;
      });
    } finally {
      setStreaming(false);
    }
  };

  const clearHistory = async () => {
    if (!confirm('チャット履歴をすべて削除しますか？')) return;
    await fetch('/api/chat', { method: 'DELETE' });
    setMessages([]);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-3 min-h-[200px]">
        {messages.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-700 leading-relaxed">
            <div className="font-semibold mb-2">💡 質問例</div>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="block w-full text-left text-blue-600 hover:underline text-sm"
                >
                  • {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-800'
              }`}
            >
              {m.role === 'user' ? (
                <div className="whitespace-pre-wrap">{m.content}</div>
              ) : m.content === '' ? (
                <span className="inline-block animate-pulse">考え中...</span>
              ) : (
                <MarkdownLite text={m.content} />
              )}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 sticky bottom-20 md:bottom-4 bg-gray-50 pt-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={streaming ? '応答中…' : '質問を入力'}
          disabled={streaming}
          className="flex-1 h-12 px-4 rounded-xl border border-gray-300 bg-white"
          maxLength={4000}
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="h-12 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-xl"
        >
          送信
        </button>
      </form>

      {messages.length > 0 && (
        <button
          onClick={clearHistory}
          className="text-xs text-gray-500 hover:text-red-500 underline block mx-auto"
        >
          履歴をクリア
        </button>
      )}
    </div>
  );
}
