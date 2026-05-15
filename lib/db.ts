// @ts-expect-error: @neondatabase/serverless の package.json exports と
// tsconfig moduleResolution=bundler の組み合わせで型解決されないだけ。
// 実行時は問題なく動作する。
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  // 起動時に明確なエラーを出す（ビルドタイムは undefined を許容）
  if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
    console.warn('[db] DATABASE_URL is not set');
  }
}

export const sql = neon(url ?? 'postgresql://placeholder@placeholder/placeholder');
