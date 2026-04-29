// Neon Postgres スキーマを適用するスクリプト
// 実行: npm run db:migrate （.env.local の DATABASE_URL を使用）
//
// 動作:
//  1. db/schema.sql （初期スキーマ）を冪等に適用
//  2. db/migrations/*.sql を名前順に冪等に適用
// すべての SQL は IF NOT EXISTS / IF EXISTS を活用して再実行可能にしている。

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function loadEnv() {
  if (process.env.DATABASE_URL) return;
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const envPath = join(__dirname, '..', '.env.local');
    const txt = await readFile(envPath, 'utf-8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let v = m[2];
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        process.env[m[1]] = v;
      }
    }
  } catch {
    // ignore
  }
}

await loadEnv();

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url || url.includes('placeholder')) {
  console.error(
    '❌ DATABASE_URL が設定されていません。.env.local に Neon 接続文字列を設定してください。',
  );
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const baseDir = join(__dirname, '..', 'db');

async function loadAllSql() {
  const files = [];
  files.push({ name: 'schema.sql', path: join(baseDir, 'schema.sql') });

  try {
    const migDir = join(baseDir, 'migrations');
    const list = (await readdir(migDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const f of list) {
      files.push({ name: `migrations/${f}`, path: join(migDir, f) });
    }
  } catch {
    // migrations フォルダがない場合は無視
  }
  return files;
}

console.log('Connecting to Neon...');
const pool = new Pool({ connectionString: url });
const client = await pool.connect();

try {
  const files = await loadAllSql();
  for (const file of files) {
    const sql = await readFile(file.path, 'utf-8');
    console.log(`Applying ${file.name}...`);
    await client.query(sql);
  }
  console.log('✅ All migrations complete.');
} finally {
  client.release();
  await pool.end();
}
