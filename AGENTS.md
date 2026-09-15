<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# rally-sの運用ルール

- 移行元は「エフクリ改Ⅲサイト」のライフプラン20260915-6版。このディレクトリを会社側の作業コピーとする。
- 現在は移行準備中。GitHub・Vercel・DB接続はPRODUCTION_SETUP.mdで確認し、未設定値を推測してデプロイしない。
- 旧個人プロジェクトefukuri-member-platformは並行稼働として保持する。旧.vercelや旧.env.localをコピーしない。
- ソース・デザイン・企業リンクの仕様を移行と無関係に変更しない。
- 会社リポジトリは非公開。環境変数、トークン、管理者情報、DBバックアップ、作業出力をcommitしない。
- 新環境のPreviewとProductionは独立DBを使う。認証やAPIの検証前に接続先を確認する。
- 接続完了後の通常リリースは、作業ブランチで修正→ローカル検証→push→Preview確認→main統合→本番確認。
- 本番反映まで含む依頼では検証後に進める。ユーザーが案のみ・ローカルのみと指定した場合はその範囲を守る。
- 本番への反映成功はVercelの状態・commit・公開URLで確認する。push成功のみで完了と報告しない。
- 認証アカウントを変更した場合はGitHub/Vercelの権限・commit作者を確認。秘密情報を出力しない。
