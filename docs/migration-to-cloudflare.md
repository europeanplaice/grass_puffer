# Cloudflare Pages + Workers KV 移行手順

GitHub Pages (GIS implicit grant) から Cloudflare Pages + Workers KV (OAuth authorization code flow) への移行手順書。

---

## 前提条件

- `wrangler` CLI がインストール済み（`npm run workers:dev` で使用する）
- Cloudflare アカウントを持っていること
- Google Cloud Console へのアクセス権があること
- GitHub リポジトリの Settings 権限があること

```bash
# wrangler のバージョン確認
npx wrangler --version
```

---

## 1. Cloudflare にログイン

```bash
npx wrangler login
```

ブラウザが開いてCloudflareアカウントの認証を求められる。

---

## 2. KV Namespace を作成する

### 本番用

```bash
npx wrangler kv:namespace create SESSIONS
```

出力例:
```
🌀 Creating namespace with title "grass-puffer-SESSIONS"
✅ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "SESSIONS", id = "abc123def456..." }
```

出力された `id` をメモする。

### 開発用（preview）

```bash
npx wrangler kv:namespace create SESSIONS --preview
```

出力された `preview_id` をメモする。

### wrangler.toml を更新

`wrangler.toml` の `REPLACE_WITH_*` を実際のIDに書き換える:

```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "ここに本番用IDを貼る"
preview_id = "ここに開発用IDを貼る"
```

---

## 3. Cloudflare Pages プロジェクトを作成する

### ビルドして初回デプロイ

```bash
npm run build
npx wrangler pages deploy dist --project-name=grass-puffer
```

初回実行時に「新規プロジェクトを作成しますか？」と聞かれるので `y` を選ぶ。

> **注意**: `VITE_GOOGLE_CLIENT_ID` がないとビルドが通らない場合は `.env.local` に設定してからビルドする。

---

## 4. Cloudflare Pages の環境変数を設定する

### wrangler CLI で設定する方法

```bash
# Production 環境
npx wrangler pages secret put GOOGLE_CLIENT_ID --project-name=grass-puffer
npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name=grass-puffer
npx wrangler pages secret put SESSION_DOMAIN --project-name=grass-puffer
```

各コマンド実行時に値の入力を求められる:
- `GOOGLE_CLIENT_ID`: Google Cloud Console の OAuth 2.0 クライアントID（`.apps.googleusercontent.com` で終わるもの）
- `GOOGLE_CLIENT_SECRET`: Google Cloud Console の OAuth 2.0 クライアントシークレット
- `SESSION_DOMAIN`: カスタムドメイン（例: `diary.example.com`）

### ダッシュボードで設定する方法（代替）

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → `grass-puffer`
2. Settings → Environment variables → Add variable
3. 上記3つの変数を **Production** と **Preview** の両方に設定

---

## 5. カスタムドメインを設定する

```bash
# まず Cloudflare Pages の本番 URL を確認
npx wrangler pages deployment list --project-name=grass-puffer
```

ダッシュボードからカスタムドメインを設定:
1. Workers & Pages → `grass-puffer` → Custom domains → Set up a custom domain
2. 使用するドメインを入力
3. DNS の CNAME レコードが自動追加される（Cloudflare 管理ドメインの場合）

---

## 6. Google Cloud Console の設定を更新する

[Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → 既存の OAuth 2.0 クライアント

### Authorized redirect URIs に追加

```
https://<your-domain>/auth/callback
http://localhost:8788/auth/callback
```

例:
```
https://diary.example.com/auth/callback
http://localhost:8788/auth/callback
```

### Authorized JavaScript origins（旧 GIS 用）

GIS implicit grant は不要になるため、GitHub Pages の origin は削除してよい:
- 削除: `https://<username>.github.io`

> **注意**: 削除する前に GitHub Pages が完全に無効化されていることを確認する。

---

## 7. GitHub Secrets を更新する

[GitHub リポジトリ] → Settings → Secrets and variables → Actions

### 追加するシークレット

| シークレット名 | 値 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API トークン（後述） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID |

`GOOGLE_CLIENT_ID` は引き続きビルド時に使用するので **残す**。

### Cloudflare API トークンの取得

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → My Profile → API Tokens
2. Create Token → Use template: **Cloudflare Pages**
3. 生成されたトークンをコピーして `CLOUDFLARE_API_TOKEN` に設定

### Cloudflare Account ID の確認

```bash
npx wrangler whoami
```

または Cloudflare Dashboard の右サイドバーに表示されている「Account ID」をコピー。

---

## 8. GitHub Pages を無効化する

### リポジトリ設定から無効化

1. GitHub リポジトリ → Settings → Pages
2. **Source** を `Deploy from a branch` → **None** に変更
3. Save

### gh-pages ブランチの削除（任意）

```bash
git push origin --delete gh-pages
```

> もう使わないが、削除は任意。残しておいても害はない。

---

## 9. 動作確認

### ローカル開発

```bash
# まず Vite dev server を起動（別ターミナル）
npm run dev

# wrangler pages dev で Functions + Vite をまとめて起動
npm run workers:dev
# → http://localhost:8788 でアクセス
```

確認項目:
- [ ] `http://localhost:8788` でログイン画面が表示される
- [ ] 「Sign in with Google」をクリックすると Google の同意画面にリダイレクトされる
- [ ] 同意後にアプリ画面が表示される
- [ ] DevTools → Application → Cookies に `grass_session` (HttpOnly) が存在する
- [ ] DevTools → Network で Drive API コールが `/api/drive/*` 経由になっている（`googleapis.com` への直接リクエストがない）

### 本番デプロイ後

```bash
# セッション一覧を確認
npx wrangler kv:key list --binding=SESSIONS --namespace-id=<本番KV ID>

# ログイン後にセッションが作成されていることを確認
# ログアウト後にセッションが削除されていることを確認
```

---

## 10. 本番へのデプロイフロー（以降の運用）

`main` ブランチに push すると GitHub Actions が自動で:
1. lint / unit-test / e2e-test / npm-audit を実行
2. 全部通ったら `wrangler pages deploy` で Cloudflare Pages にデプロイ

手動デプロイしたい場合:
```bash
npm run build
npm run cf:deploy
```

---

## トラブルシューティング

### `REPLACE_WITH_KV_ID` のままデプロイしてしまった

```bash
# wrangler.toml を更新してから再デプロイ
npm run build
npm run cf:deploy
```

### セッションが切れない（ログアウトしても再ログインを求められない）

```bash
# KV から手動でセッションを削除
npx wrangler kv:key list --binding=SESSIONS --namespace-id=<KV ID>
npx wrangler kv:key delete <session-key> --binding=SESSIONS --namespace-id=<KV ID>
```

### `SESSION_DOMAIN` の設定ミスでcookieが保存されない

`SESSION_DOMAIN` はスキームなしのホスト名のみ（例: `diary.example.com`）。
`https://` を含めないこと。

### ローカルで `http://localhost:8788/auth/callback` が動かない

Google Cloud Console の Authorized redirect URIs に `http://localhost:8788/auth/callback` が追加されているか確認する。
