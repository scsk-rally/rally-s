# rally-s

SCSK株式会社の会社管理環境へ移行するためのソースです。
移行元：エフクリ改Ⅲサイト、2026-09-15のライフプラン最終調整版（20260915-6）。

## 状態

移行準備中。GitHubの非公開リポジトリ https://github.com/scsk-rally/rally-s を作成済み。新Vercelは未接続です。
希望リポジトリ名・Vercelプロジェクト名：rally-s。
希望URL：rally-s.vercel.app（未取得）。
旧本番は別環境として維持します。

## ローカル開発

Node.js 24 LTSを想定。依存関係はpackage-lock.jsonで固定します。

```sh
npm ci
npm run dev
```

データベースなしの開発モードは本番相当の検証には使えません。
必要な環境変数は.env.exampleを参照し、開発専用DBを利用してください。

## 反映前の確認

```sh
npm run audit
npm run build
```

`npm run audit`はサイト内リンク・構文等の静的監査です。
依存パッケージの脆弱性を調べる`npm audit`とは異なります。
変更した画面やAPI、認証・データ操作も別途検証します。

## 公開

[公開・並行稼働手順](PRODUCTION_SETUP.md)と[作業ルール](AGENTS.md)を参照。
接続完了後は作業ブランチ→Preview検証→main統合→Vercel本番確認の順で進めます。
