@AGENTS.md

# Deploy workflow (default)

Vercel は `main` への push を本番デプロイする構成。フィーチャーブランチで作業した変更を反映させるには、以下を**毎回の基本フロー**として実行する:

1. 指定された feature ブランチでコミット → push
2. **必ず main 向けの Pull Request を作成する**（`mcp__github__create_pull_request` を使う）。ユーザーが「PRを作って」と明示しなくても、Vercel 反映が目的の変更ではこれを既定動作とする
3. PR URL をユーザーに伝え、マージはユーザー自身に委ねる（勝手に merge / main へ直接 push しない）
4. 作業完了報告では「push 済み」だけでなく「PR #N を作成済み、マージで本番反映」まで明示する

例外: ユーザーが「PR は不要」「Preview だけでよい」と明言した場合のみ PR 作成をスキップ。
