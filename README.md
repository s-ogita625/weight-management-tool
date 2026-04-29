# 体重管理ツール

身長・体重・体脂肪率・性別・筋トレ頻度をもとに、目標体重・体脂肪率を達成するための **食事プラン（カロリー・PFC栄養）** を、最新のスポーツ栄養学（ISSN・ACSM）に基づいて算出する Web アプリです。

## 主な機能

- プロフィール入力（身長・体重・体脂肪率・性別・年齢・筋トレ頻度・目標値）
- 期間選択（1ヶ月／3ヶ月／半年／1年）
- **2つの計算式を比較表示**: Mifflin-St Jeor 式 / Katch-McArdle 式
- 推奨カロリー・PFC マクロ自動算出
- 日々の食事記録 & 履歴閲覧
- スマホ最適化UI（モバイルファースト Tailwind）
- メール/パスワード認証 + bcrypt + JWT セッション（HttpOnly Cookie）

## 技術スタック

- **Next.js 16** (App Router) / **React 19** / TypeScript
- **Tailwind CSS v4**
- **Neon** (Serverless Postgres, `@neondatabase/serverless`)
- **bcryptjs** + **jose** (HS256 JWT)
- **Vercel** デプロイ

## セットアップ（ローカル開発）

### 1. 依存インストール

```bash
npm install
```

### 2. Neon プロジェクト作成

1. <https://console.neon.tech/> で Sign up（GitHub または Google で）
2. 「Create project」 — Region は `AWS Asia Pacific 1 (Tokyo)` を推奨
3. ダッシュボード右上の「Connect」または「Connection string」から `postgresql://...` をコピー

### 3. 環境変数

`.env.example` をコピーして `.env.local` を作成し、以下を編集：

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
SESSION_SECRET=...
```

`SESSION_SECRET` は次のコマンドで生成可能：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 4. スキーマ適用

```bash
npm run db:migrate
```

または Neon Console → SQL Editor で `db/schema.sql` の中身を貼り付けて実行。

### 5. 起動

```bash
npm run dev
```

<http://localhost:3000>

## デプロイ（Vercel）

```bash
git init
git add .
git commit -m "Initial commit"
gh auth login                # 初回のみ
gh repo create weight-management-tool --public --source=. --remote=origin --push
npx vercel login             # 初回のみ
npx vercel link
# Vercel Marketplace から Neon を Connect すると DATABASE_URL が自動で本番環境にセットされる
npx vercel env add SESSION_SECRET production
npx vercel deploy --prod
```

## 計算ロジックの根拠

- **Mifflin-St Jeor (1990)** … 一般的な BMR 推定式（`Am J Clin Nutr` 掲載）
- **Katch-McArdle** … 除脂肪体重ベース（体脂肪率が信頼できる場合より精度高）
- 活動係数: 筋トレ頻度→ 1.2 / 1.375 / 1.55 / 1.725
- 週次変化は「体重の ±1%/週」で安全クランプ
- マクロ配分は ISSN Position Stand (Jäger et al. 2017 / Aragon et al. 2017) を参考

詳細は `lib/calculations.ts` および `components/results/CitationNote.tsx` を参照。

## ⚠️ 免責事項

本ツールが提供する数値は参考情報であり、医療・栄養指導の代替ではありません。基礎疾患のある方、妊娠中の方、未成年の方は医師・管理栄養士にご相談ください。
