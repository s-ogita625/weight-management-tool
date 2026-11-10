# Fitbit Air → 体重管理ツール 連携（Google Health API）

Fitbit Air のデータは Google Health アプリ経由でクラウドに同期され、**Google Health API（v4）** から読み取れます。
旧 Fitbit Web API は 2026年11月2日に停止済みなので、この API を使います。

## 取り込むデータ

| データ | 使い道 |
|---|---|
| 歩数・距離・アクティブゾーン分 | ホームの Fitbit カード |
| 消費カロリー（total-calories） | 今日の収支、直近7日の「平均消費 vs 平均摂取」 |
| 睡眠（合計・深い/レム/浅い・覚醒） | 朝の記録の睡眠時間を自動記録（連携中は入力欄なし）→ 睡眠と体重の分析に使われる |
| 運動（筋トレ・ウォーキング等） | 「運動」タブに表示。筋トレ等をした日はトレ日の目標カロリーに切り替え |
| 安静時心拍・HRV | 自分の30日平均と比べ、睡眠と合わせて「回復度（疲労度）」を推定 |
| 体重・体脂肪率 | eufyLife 等 → Health Connect → Google Health に届いたものを朝の記録に自動入力（その日の最初の測定を採用。アプリで手入力済みの日は上書きしない。抜けている期間は最大180日さかのぼって補完） |

同期は毎朝7時（Vercel Cron）と、ホームを開いたとき（前回から3時間以上たっていれば裏で実行）。読み取り専用で、Google 側のデータは変更しません。

## 設定済みの内容（2026-11-10）

- Google アカウント: ogitashiyu@gmail.com
- プロジェクト: `weight-management-tool`（課金アカウントなし）
- Google Health API: 有効
- 同意画面: 外部 / 本番環境（未審査・100ユーザーまで）/ ホームページ・プライバシーポリシー（/privacy）・利用規約（/terms）
- スコープ: activity_and_fitness.readonly, sleep.readonly, health_metrics_and_measurements.readonly
- OAuth クライアント: ウェブ アプリケーション「weight-management-tool web」
  - リダイレクト URI: `https://weight-management-tool.vercel.app/api/google-health/callback`, `http://localhost:3000/api/google-health/callback`
- Vercel（Production）: `GOOGLE_HEALTH_CLIENT_ID` 設定済み / `GOOGLE_HEALTH_CLIENT_SECRET` は本人が設定

## 準備（Google Cloud で1回だけ）

1. https://console.cloud.google.com/ で新しいプロジェクトを作成（例: `weight-management-tool`）
2. 「API とサービス」→「ライブラリ」で **Google Health API** を有効化
3. 「Google Auth Platform」→「ブランディング」でアプリ名とサポートメールを入力
4. 「対象」で ユーザーの種類 = **外部**
   - テスト中のままだと**リフレッシュトークンが7日で切れる**（毎週つなぎ直しが必要）
   - 「アプリを公開」で本番にすると切れなくなる。未審査のままでも 100 ユーザーまで使える（同意画面に「未確認のアプリ」と出るので「詳細」→「移動」で進む）
   - テスト中のままにする場合は「テストユーザー」に Fitbit Air をつないでいる Google アカウントを追加
5. 「データアクセス」→「スコープを追加」で次の2つを追加
   - `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`
   - `https://www.googleapis.com/auth/googlehealth.sleep.readonly`
   - `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly`（安静時心拍・HRV）
6. 「クライアント」→「クライアントを作成」→ 種類 **ウェブ アプリケーション**
   - 承認済みのリダイレクト URI に次を追加
     - `https://<本番のドメイン>/api/google-health/callback`
     - `http://localhost:3000/api/google-health/callback`（ローカルで試す場合）
7. 表示されたクライアント ID とシークレットを環境変数に設定

```bash
npx vercel env add GOOGLE_HEALTH_CLIENT_ID production
```

```bash
npx vercel env add GOOGLE_HEALTH_CLIENT_SECRET production
```

ローカルでは `.env.local` に同じ2つを書く。

## DB

`db/migrations/0013_google_health.sql`（`health_connections` と `wearable_daily`）と `0014_wearable_recovery.sql`（安静時心拍・HRV の列）を適用する。
トークンは `SESSION_SECRET` から作った鍵で AES-256-GCM 暗号化して保存する。

## 使い方

メニュー →「Fitbit 連携」→「Google Health と連携する」→ Google アカウントで許可。
初回は過去30日分、「過去90日を取り込む」で最大90日分を取り込めます。

## 注意

- Google Health API の `googlehealth.*` スコープは「制限付き」扱い。100 ユーザーを超えて配布するには Google のセキュリティ審査が必要（個人利用なら不要）。
- Fitbit アプリの「コンディションスコア」そのものは API にないため、安静時心拍・HRV・睡眠から近い考え方で推定している。
- 心拍・HRV の権限は後から追加したので、それ以前に連携した場合は設定画面の「再連携」で権限を追加する。
