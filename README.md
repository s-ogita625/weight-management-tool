# 体重管理ツール

身長・体重・体脂肪率・性別・筋トレ頻度をもとに、目標体重・体脂肪率を達成するための **食事プラン（カロリー・PFC栄養）** を、最新のスポーツ栄養学（ISSN・ACSM）に基づいて算出する Web アプリです。

## 主な機能

- プロフィール入力（身長・体重・体脂肪率・性別・年齢・筋トレ頻度・目標値）
- 期間選択（1ヶ月／3ヶ月／半年／1年）
- **2つの計算式を比較表示**: Mifflin-St Jeor 式 / Katch-McArdle 式
- 推奨カロリー・PFC マクロ自動算出
- 日々の食事記録 & 履歴閲覧
- スマホ最適化UI（モバイルファースト Tailwind）
- Supabase Auth（メール/パスワード）と RLS による安全なデータ保存

## 技術スタック

- Next.js 16 (App Router) / React 19 / TypeScript
- Tailwind CSS v4
- Supabase (Auth + Postgres + RLS)
- Vercel デプロイ

## セットアップ（ローカル開発）

### 1. 依存インストール

```bash
npm install
```

### 2. Supabase プロジェクト作成

1. <https://supabase.com/dashboard> で「New project」
2. Region は Tokyo (`ap-northeast-1`) 推奨
3. SQL Editor で `supabase/migrations/0001_init.sql` を実行
4. Settings → API から `Project URL` と `anon public key` を取得
5. Authentication → Providers → Email を有効化
6. Authentication → URL Configuration の Site URL に `http://localhost:3000`、Redirect URLs に `http://localhost:3000/**` を追加

### 3. 環境変数

`.env.example` をコピーして `.env.local` を作成：

```bash
cp .env.example .env.local
```

実際の Supabase URL / Anon Key を記入。

### 4. 起動

```bash
npm run dev
```

<http://localhost:3000> で確認。

## デプロイ（Vercel）

```bash
git init
git add .
git commit -m "Initial commit"
gh auth login                # 初回のみ
gh repo create weight-management-tool --public --source=. --remote=origin --push
npx vercel login             # 初回のみ
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel deploy --prod
```

デプロイ後、本番URLを Supabase の Authentication → URL Configuration の Site URL / Redirect URLs に追加してください。

## 計算ロジックの根拠

- **Mifflin-St Jeor (1990)** … 一般的な BMR 推定式（精度高、`Am J Clin Nutr` 掲載）
- **Katch-McArdle** … 除脂肪体重ベース（体脂肪率が信頼できる場合より精度高）
- 活動係数: 筋トレ頻度→ 1.2 / 1.375 / 1.55 / 1.725
- 週次変化は「体重の ±1%/週」で安全クランプ
- マクロ配分は ISSN Position Stand (Jäger et al. 2017 / Aragon et al. 2017) を参考

詳細は `lib/calculations.ts` および `components/results/CitationNote.tsx` を参照。

## ⚠️ 免責事項

本ツールが提供する数値は参考情報であり、医療・栄養指導の代替ではありません。基礎疾患のある方、妊娠中の方、未成年の方は医師・管理栄養士にご相談ください。
