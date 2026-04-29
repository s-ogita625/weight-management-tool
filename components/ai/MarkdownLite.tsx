/**
 * 軽量Markdownレンダラ。AIから返ってくる小さな出力に対応するため、
 * - 見出し ## / ###
 * - 太字 **
 * - 斜体 *
 * - コード `inline`
 * - 箇条書き -, *
 * - 番号付き 1.
 * - 改行 / 段落
 * のみサポート。XSSを避けるため React の text ノードに変換する。
 */

import React from 'react';

interface Props {
  text: string;
}

function renderInline(line: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // パターン: **太字** | *斜体* | `code`
  const regex = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)/g;
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
    } else if (t.startsWith('*') && t.endsWith('*')) {
      nodes.push(<em key={key++}>{t.slice(1, -1)}</em>);
    } else if (t.startsWith('`') && t.endsWith('`')) {
      nodes.push(
        <code
          key={key++}
          className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono"
        >
          {t.slice(1, -1)}
        </code>,
      );
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

  const flushUL = () => {
    if (listBuf.length > 0) {
      blocks.push(
        <ul
          key={`ul-${blocks.length}`}
          className="list-disc list-outside ml-5 space-y-1 my-2"
        >
          {listBuf.map((l, i) => (
            <li key={i}>{renderInline(l)}</li>
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
            <li key={i}>{renderInline(l)}</li>
          ))}
        </ol>,
      );
      orderedBuf = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    if (line === '') {
      flushUL();
      flushOL();
      continue;
    }
    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const ul = line.match(/^\s*[-*]\s+(.*)/);
    const ol = line.match(/^\s*\d+\.\s+(.*)/);
    if (h3) {
      flushUL();
      flushOL();
      blocks.push(
        <h3 key={blocks.length} className="font-semibold mt-3 mb-1 text-gray-900">
          {renderInline(h3[1])}
        </h3>,
      );
    } else if (h2) {
      flushUL();
      flushOL();
      blocks.push(
        <h2 key={blocks.length} className="font-bold mt-4 mb-2 text-gray-900">
          {renderInline(h2[1])}
        </h2>,
      );
    } else if (ul) {
      flushOL();
      listBuf.push(ul[1]);
    } else if (ol) {
      flushUL();
      orderedBuf.push(ol[1]);
    } else {
      flushUL();
      flushOL();
      blocks.push(
        <p key={blocks.length} className="my-1.5">
          {renderInline(line)}
        </p>,
      );
    }
  }
  flushUL();
  flushOL();
  return <>{blocks}</>;
}
