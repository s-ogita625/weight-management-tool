// Neon Postgres スキーマを適用するスクリプト
// 実行: DATABASE_URL=... node scripts/migrate.mjs
// あるいは npm run db:migrate （.env.local の DATABASE_URL を使用）

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { neon } from '@neondatabase/serverless';

// .env.local の DATABASE_URL を簡易的に読む
async function loadEnv() {
  if (process.env.DATABASE_URL) return;
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const envPath = join(__dirname, '..', '.env.local');
    const txt = await readFile(envPath, 'utf-8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // ignore
  }
}

await loadEnv();

if (
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes('placeholder')
) {
  console.error(
    '❌ DATABASE_URL が設定されていません。.env.local に Neon 接続文字列を設定してください。',
  );
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, '..', 'db', 'schema.sql');
const sqlContent = await readFile(sqlPath, 'utf-8');

console.log('Connecting to Neon...');
const sql = neon(process.env.DATABASE_URL);

console.log('Running schema migration...');
// Neon serverless の sql.unsafe で複数ステートメント実行
await sql.unsafe(sqlContent);

console.log('✅ Migration complete.');
