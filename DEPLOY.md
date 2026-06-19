# シフトくん 公開手順

## 初期アクセス許可

初期許可ユーザーは以下です。

- cs.administrator@mensclear.com
- cs.leader2@mensclear.com

`app.js` の `AUTH_CONFIG.googleClientId` に Google OAuth クライアントIDを設定し、`AUTH_CONFIG.enabled` を `true` にするとGoogleログイン制限が有効になります。

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

ブラウザだけではGoogleグループ所属を安全に検証できません。グループ単位で厳密に制限する場合は、Google Cloud IAP または Cloud Run + サーバー側IDトークン検証を使ってください。

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
