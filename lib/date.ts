/**
 * 日付ユーティリティ。
 * このアプリでは「ユーザーの今日」は JST (Asia/Tokyo, UTC+9) として扱う。
 * Vercel のサーバーは UTC で動くので、サーバー側で `new Date()` をそのまま
 * `YYYY-MM-DD` 化すると深夜帯にクライアントとずれてしまう。
 *
 * `dateInJST` は Date オブジェクトを JST タイムゾーンの YYYY-MM-DD に変換する。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function dateInJST(d: Date = new Date()): string {
  const jst = new Date(d.getTime() + JST_OFFSET_MS);
  return jst.toISOString().slice(0, 10);
}

export function timeInJST(d: Date = new Date()): string {
  const jst = new Date(d.getTime() + JST_OFFSET_MS);
  return jst.toISOString().slice(11, 16); // HH:MM
}
