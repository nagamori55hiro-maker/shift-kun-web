# Googleグループ認証 Worker

このWorkerは、GoogleログインのIDトークンを検証し、Google Workspaceのグループに実際に所属しているかを確認します。

## 必要な組織側設定

1. Google Cloudで Admin SDK API を有効化
2. サービスアカウントを作成し、ドメイン全体の委任を有効化
3. Google Workspace 管理コンソールでサービスアカウントのOAuthクライアントIDを追加
4. 次のスコープを委任

```text
https://www.googleapis.com/auth/admin.directory.group.member.readonly
```

サービスアカウントの委任先には、グループメンバーを確認できる Workspace 管理者メールアドレスを設定します。

## Cloudflare Workers への公開

```bash
cd group-auth-worker
Copy-Item wrangler.toml.example wrangler.toml
npx wrangler login
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
npx wrangler secret put GOOGLE_WORKSPACE_ADMIN_EMAIL
npx wrangler deploy
```

公開後に表示されるURLを、`app.js` の `GROUP_AUTH_CONFIG.endpoint` へ設定して GitHub Pages を更新します。

## 注意

Worker用のサービスアカウント秘密鍵や管理者メールは、GitHub Pages、Gitリポジトリ、ブラウザへ保存しません。CloudflareのSecretとしてのみ設定します。
