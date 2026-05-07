/**
 * 軽量Markdownレンダラ。AIから返ってくる出力に対応するため、
 * - 見出し # ## ### #### #####
 * - 太字 **
 * - 斜体 *
 * - インラインコード `code`
 * - 箇条書き -, *
 * - 番号付き 1.
 * - 引用 >
 * - 改行 / 段落
 * - 水平線 ---
 * のみサポート。XSSを避けるため React の text ノードに変換する。
 */

import React from 'react';

interface Props {
  text: string;
}

function renderInline(line: string): React.ReactNode[] {
  if (!line) return [line];
  const nodes: React.ReactNode[] = [];
  // パターン: **太字** | *斜体* | `code` （改行を含まないように [^*\n]+ などで限定）
  const regex = /(\*\*[^*\n]+\*\*)|(`[^`\n]+`)|(\*[^*\n]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(line)) !== null) {
    if (m.index > last) {
      nodes.push(line.slice(last, m.index));
    }
    const t = m[0];
    if (t.startsWith('**') && t.endsWith('**')) {
      nodes.push(<strong key={key++}>{t.slice(2, -2)}</strong>);
    } else if (t.startsWith('`') && t.endsWith('`')) {
      nodes.push(
        <code
          key={key++}
          className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono break-all"
        >
          {t.slice(1, -1)}
        </code>,
      );
    } else if (t.startsWith('*') && t.endsWith('*')) {
      nodes.push(<em key={key++}>{t.slice(1, -1)}</em>);
    }
    last = m.index + t.length;
  }
  if (last < line.length) nodes.push(line.slice(last));
  return nodes;
}

export default function MarkdownLite({ text }: Props) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];

  let listBuf: string[] = [];
  let orderedBuf: string[] = [];
  let quoteBuf: string[] = [];

  const flushUL = () => {
    if (listBuf.length > 0) {
      blocks.push(
        <ul
          key={`ul-${blocks.length}`}
          className="list-disc list-outside ml-5 space-y-1 my-2"
        >
          {listBuf.map((l, i) => (
            <li key={i} className="break-words">
              {renderInline(l)}
            </li>
          ))}
        </ul>,
      );
      listBuf = [];
    }
  };
  const flushOL = () => {
    if (orderedBuf.length > 0) {
      blocks.push(
        <ol
          key={`ol-${blocks.length}`}
          className="list-decimal list-outside ml-5 space-y-1 my-2"
        >
          {orderedBuf.map((l, i) => (
            <li key={i} className="break-words">
              {renderInline(l)}
            </li>
          ))}
        </ol>,
      );
      orderedBuf = [];
    }
  };
  const flushQuote = () => {
    if (quoteBuf.length > 0) {
      blocks.push(
        <blockquote
          key={`q-${blocks.length}`}
          className="border-l-4 border-gray-300 pl-3 my-2 text-gray-600 italic"
        >
          {quoteBuf.map((l, i) => (
            <p key={i} className="my-1 break-words">
              {renderInline(l)}
            </p>
          ))}
        </blockquote>,
      );
      quoteBuf = [];
    }
  };
  const flushAll = () => {
    flushUL();
    flushOL();
    flushQuote();
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    if (line === '') {
      flushAll();
      continue;
    }
    // 水平線
    if (/^(---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushAll();
      blocks.push(
        <hr key={blocks.length} className="my-3 border-gray-200" />,
      );
      continue;
    }
    // 見出し（深い順にチェック）
    const h5 = line.match(/^#####\s+(.*)/);
    const h4 = line.match(/^####\s+(.*)/);
    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    const ul = line.match(/^\s*[-*+]\s+(.*)/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    const quote = line.match(/^>\s?(.*)/);

    if (h5 || h4) {
      flushAll();
      const content = (h5 ?? h4)![1];
      blocks.push(
        <h4
          key={blocks.length}
          className="font-semibold mt-2 mb-1 text-gray-900 text-sm break-words"
        >
          {renderInline(content)}
        </h4>,
      );
    } else if (h3) {
      flushAll();
      blocks.push(
        <h3
          key={blocks.length}
          className="font-semibold mt-3 mb-1 text-gray-900 break-words"
        >
          {renderInline(h3[1])}
        </h3>,
      );
    } else if (h2) {
      flushAll();
      blocks.push(
        <h2
          key={blocks.length}
          className="font-bold mt-4 mb-2 text-gray-900 text-base break-words"
        >
          {renderInline(h2[1])}
        </h2>,
      );
    } else if (h1) {
      flushAll();
      blocks.push(
        <h1
          key={blocks.length}
          className="font-bold mt-4 mb-2 text-gray-900 text-lg break-words"
        >
          {renderInline(h1[1])}
        </h1>,
      );
    } else if (ul) {
      flushOL();
      flushQuote();
      listBuf.push(ul[1]);
    } else if (ol) {
      flushUL();
      flushQuote();
      orderedBuf.push(ol[1]);
    } else if (quote) {
      flushUL();
      flushOL();
      quoteBuf.push(quote[1]);
    } else {
      flushAll();
      blocks.push(
        <p key={blocks.length} className="my-1.5 break-words leading-relaxed">
          {renderInline(line)}
        </p>,
      );
    }
  }
  flushAll();
  return <>{blocks}</>;
}
