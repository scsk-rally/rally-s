# 会社Vercelへの公開手順

## 接続状態

- GitHub Organization：scsk-rally（会社名SCSK株式会社で作成済み）。管理ユーザー：scsk-rallys。
- リポジトリ：https://github.com/scsk-rally/rally-s（2026-09-15に一時的にpublicへ変更）。
- 新Vercelチーム：SCSK rally（Hobby、URL namespace: `k-645a`）。
- 新Vercelプロジェクト：rally-s（作成済み、GitHub連携済み）。
- 本番URL：https://rally-s.vercel.app（初回デプロイ成功）。
- Production branch：main（接続時に設定）。
- 旧本番：efukuri-member-platform.vercel.app。並行稼働として保持。

実際に作成・接続したら、その時点で確認できた識別子とURLに更新する。
旧プロジェクトの.vercelをコピーしてはいけない。

## 接続時に実施

1. 会社GitHub Organizationに非公開リポジトリを作り、送信対象を確認してpush。
2. 会社VercelチームのGit連携で対象リポジトリだけを接続。Root Directoryはリポジトリ直下、FrameworkはNext.js、Node.jsは24.x、Build Commandはnpm run build。実際のビルドで確認する。
3. ProductionとPreviewそれぞれに独立DB・必要な環境変数を設定。本番データへ接続した状態で検証しない。
4. 新Blobへ画像を複製し、必要なDB内URLを書き換えて確認。
5. 希望ドメインの取得可否をVercelで確認して設定。
6. mainのデプロイ成功、commit、利用者・管理者・API・画像・PDFを確認。

GitHubへのpushだけでデプロイ完了とは扱わない。
Git連携を使用し、CLIで同じ変更を重複デプロイしない。

## 通常の開発・本番反映

1. 変更内容を確認して作業ブランチを作成。
2. 実装、差分・秘密情報確認、npm run audit、npm run build、変更に応じたテスト。
3. pushしVercel Previewの動作を確認。
4. 本番反映まで依頼されている場合は検証後mainへ統合。設計案のみ・ローカルのみの依頼では公開しない。
5. 本番デプロイのREADY、commit、実際のURLと対象フローを確認して報告。
6. 問題があれば新環境内で直前の正常版へ戻し、原因を確認する。DBの復元はアプリのロールバックとは別判断。

GitHub Freeの非公開リポジトリでは必須レビュー・保護ブランチの強制は前提にしない。

## 並行稼働とデータ

新環境検証中の業務更新先は旧環境。新旧の独立DBは自動同期されない。
正式切替時には更新停止時間を決め、差分を最終同期して更新先を切り替える。
旧本番の削除、改名、DB変更、通常リリースの送信先への利用は行わない。

初回APIアクセスでDB初期化が走るため、接続先を確認してから動作確認する。
固定企業リンクを維持する正式移行ではAUTH_SECRET、企業ID、link_versionの互換性を確認。
ホスト名を含む旧配布URLは自動では変わらない。旧URLを維持し、正式ドメイン時の導線を別途決める。

## 費用・本人操作

GitHub OrganizationはFreeで開始。Vercelのプロジェクト作成画面でProの14日間無料トライアルを選んだところ、カード情報と請求先住所の入力が必須と表示された（2026-09-15）。カード未登録の方針に従い、入力もトライアル開始も行わず取消済み。
カード登録、有料契約、本人認証、パスワード設定、規約同意は本人が操作する。
無料期間終了後の会社運用にHobbyを使えるとは扱わない。現時点で非公開OrganizationリポジトリをVercelでデプロイするには、カード登録を伴うProへの移行が必要。

HobbyでGit連携を継続するため、`rally-s` は現在publicである。Proへ移行してからprivateへ戻す。Hobbyのままprivateへ戻すと、会社OrganizationのGit連携による以後のデプロイを継続できない。

## 初回デプロイの記録

- 実行日：2026-09-15
- Git commit：`f0523d4`
- デプロイ結果：READY
- 公開ページ：`https://rally-s.vercel.app/login.html` を確認
- 環境変数：未設定。空欄の6キーは登録せず除外。
- この状態ではログイン画面など静的公開部分は確認できる。新しいDB、AUTH_SECRET、管理者初期情報、Blobを独立して設定するまで、管理・会員APIを本番利用しない。

確認元（2026-09-15）：
- https://vercel.com/docs/git
- https://vercel.com/docs/limits/fair-use-guidelines
- https://vercel.com/docs/plans/pro-plan/trials
