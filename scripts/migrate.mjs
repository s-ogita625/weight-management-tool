// Neon Postgres スキーマを適用するスクリプト
// 実行: DATABASE_URL=... node scripts/migrate.mjs
// あるいは npm run db:migrate （.env.local の DATABASE_URL を使用）

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Node.js では WebSocket constructor を渡す必要がある
neonConfig.webSocketConstructor = ws;

// .env.local の値を簡易的に読む
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
const sqlPath = join(__dirname, '..', 'db', 'schema.sql');
const sqlContent = await readFile(sqlPath, 'utf-8');

console.log('Connecting to Neon...');
const pool = new Pool({ connectionString: url });
const client = await pool.connect();

try {
  console.log('Running schema migration...');
  await client.query(sqlContent);
  console.log('✅ Migration complete.');
} finally {
  client.release();
  await pool.end();
}
