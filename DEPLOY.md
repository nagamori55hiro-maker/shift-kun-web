# シフトくん 公開手順

## 初期アクセス許可

初期許可ユーザーは以下です。

- cs.administrator@mensclear.com
- cs.leader2@mensclear.com
- nagamori55hiro@gmail.com

`app.js` の `AUTH_CONFIG.googleClientId` に Google OAuth クライアントIDを設定し、`AUTH_CONFIG.enabled` を `true` にするとGoogleログイン制限が有効になります。

## 今回の無料公開

GitHub Pages の無料枠で公開しています。

- 公開URL: https://nagamori55hiro-maker.github.io/shift-kun-web/
- GitHubリポジトリ: https://github.com/nagamori55hiro-maker/shift-kun-web
- OAuth Client ID: `309455868192-sj3j6qo659hj53lnfuelv6otu1nvcm4g.apps.googleusercontent.com`
- 承認済み JavaScript 生成元: `https://nagamori55hiro-maker.github.io`

GitHub Pages の無料プランでは公開リポジトリが前提です。アプリは静的ファイルだけで動き、アップロードしたシフト表やルールファイルはブラウザ内で処理します。

Googleログイン時に「テストユーザーではありません」と表示される場合は、Google Cloud Console の Google Auth Platform > 対象 > テストユーザーで以下を追加してください。

- cs.administrator@mensclear.com
- cs.leader2@mensclear.com
- nagamori55hiro@gmail.com

## Firebase Hostingで公開

1. Firebaseプロジェクトを作成
2. Google Cloud Consoleで OAuth 2.0 Client ID を作成
3. 承認済みJavaScript生成元に公開URLを追加
4. `app.js` の `AUTH_CONFIG` を設定
5. `.firebaserc.example` を `.firebaserc` にコピーし、プロジェクトIDを設定
6. 以下を実行

```bash
npm install -g firebase-tools
firebase login
cd outputs/shift-kun
firebase deploy --only hosting
```

## グループ単位の厳密な制限

ブラウザだけではGoogleグループ所属を安全に検証できません。現在の無料・静的版では、グループのメンバーも個別メールアドレスとして許可一覧に登録してください。

Google Workspaceのグループを自動判定する実装は `group-auth-worker` にあります。Cloudflare Workersの無料枠と、Workspace管理者が設定するAdmin SDK APIのドメイン全体の委任を使います。公開方法は `group-auth-worker/README.md` を参照し、公開URLを `app.js` の `GROUP_AUTH_CONFIG.endpoint` へ設定してください。

グループ単位で静的ファイル自体の閲覧まで厳密に制限する場合は、Google Cloud IAP または Cloudflare Access を使ってください。

IAPを使う場合は、公開先に対して以下のように許可します。

```bash
gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=YOUR_BACKEND_SERVICE \
  --member=user:cs.administrator@mensclear.com \
  --role=roles/iap.httpsResourceAccessor

gcloud iap web add-iam-policy-binding \
  --resource-type=backend-services \
  --service=YOUR_BACKEND_SERVICE \
  --member=user:cs.leader2@mensclear.com \
  --role=roles/iap.httpsResourceAccessor
```

アプリ内の「アクセス権限」欄は運用担当者が許可メールを管理するための画面です。共有保存やサーバー側強制を行う場合は、FirestoreやCloud Run APIに接続してください。
