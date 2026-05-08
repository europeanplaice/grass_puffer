# Cloudflare Pages + Workers KV 移行手順

**移行元**: GitHub Pages (`grasspuffer.europeanplaice.com`)  
**移行先**: Cloudflare Pages + Workers KV (OAuth authorization code flow)  
**カスタムドメイン**: `grasspuffer.europeanplaice.com`（そのまま引き継ぐ）

---

## 前提条件

- `wrangler` CLI がインストール済み（`package.json` の devDependencies に含まれている）
- Cloudflare アカウントを持っていること
- `europeanplaice.com` のDNS管理権限があること
- Google Cloud Console へのアクセス権があること
- GitHub リポジトリの Settings 権限があること

```bash
npx wrangler --version  # 動作確認
```

---

## Step 1: Cloudflare にログイン

```bash
npx wrangler login
```

ブラウザが開いて Cloudflare アカウントの認証を求められる。

---

## Step 2: KV Namespace を作成する

### 本番用

```bash
npx wrangler kv:namespace create SESSIONS
```

出力例:
```
✅ Success!
{ binding = "SESSIONS", id = "abc123def456..." }
```

**`id` の値をメモしておく。**

### 開発用（preview）

```bash
npx wrangler kv:namespace create SESSIONS --preview
```

**`preview_id` の値をメモしておく。**

### wrangler.toml を更新

```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "ここに本番IDを貼る"
preview_id = "ここに開発IDを貼る"
```

---

## Step 3: Cloudflare Pages プロジェクトを作成して初回デプロイ

```bash
# ビルド（.env.local に VITE_GOOGLE_CLIENT_ID が必要）
npm run build

# 初回デプロイ（プロジェクトが自動作成される）
npx wrangler pages deploy dist --project-name=grass-puffer
```

完了すると `https://grass-puffer.pages.dev` のような URL でアクセスできるようになる。（カスタムドメインは次の手順で設定）

---

## Step 4: 環境変数（シークレット）を設定する

```bash
npx wrangler pages secret put GOOGLE_CLIENT_ID --project-name=grass-puffer
# → プロンプトに OAuth クライアントID を入力（.env.local の VITE_GOOGLE_CLIENT_ID と同じ値）

npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name=grass-puffer
# → プロンプトに OAuth クライアントシークレットを入力

npx wrangler pages secret put SESSION_DOMAIN --project-name=grass-puffer
# → プロンプトに以下を入力:
#    grasspuffer.europeanplaice.com
```

> ダッシュボードからも設定できる:  
> [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → `grass-puffer` → Settings → Environment variables

---

## Step 5: カスタムドメインを設定する

### Cloudflare Dashboard から設定

1. Cloudflare Dashboard → Workers & Pages → `grass-puffer`
2. **Custom domains** タブ → **Set up a custom domain**
3. `grasspuffer.europeanplaice.com` を入力して Continue

### DNS の更新（重要）

`europeanplaice.com` の DNS 管理場所によって手順が変わる。

#### A) `europeanplaice.com` が Cloudflare で管理されている場合

Cloudflare が自動で CNAME を追加してくれる。Dashboard 上で「Active」になれば完了。

#### B) 他のレジストラ / DNS プロバイダで管理されている場合

既存の GitHub Pages 向けの CNAME を Cloudflare Pages 向けに書き換える:

| 設定項目 | 変更前（GitHub Pages） | 変更後（Cloudflare Pages） |
|---|---|---|
| Type | `CNAME` | `CNAME` |
| Name | `grasspuffer` | `grasspuffer` |
| Value | `<username>.github.io` | `grass-puffer.pages.dev` |

> DNS の変更が全世界に伝播するまで最大 48 時間かかることがあるが、通常は数分〜1時間程度。

---

## Step 6: Google Cloud Console の設定を更新する

[Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → 既存の OAuth 2.0 クライアント

### Authorized redirect URIs に追加

```
https://grasspuffer.europeanplaice.com/auth/callback
http://localhost:8788/auth/callback
```

### Authorized JavaScript origins から削除（任意）

旧 GIS implicit grant では JavaScript origins が必要だったが、新しい authorization code flow では不要になる。DNS 切り替え後に削除してよい:

- 削除: `https://grasspuffer.europeanplaice.com`（JavaScript origins の方）

> **注意**: Redirect URIs と JavaScript origins は別の設定項目。Redirect URIs は必ず追加すること。

---

## Step 7: GitHub Secrets を更新する

[GitHub リポジトリ] → Settings → Secrets and variables → Actions

### 追加するシークレット

| シークレット名 | 値 | 取得方法 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API トークン | 後述 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID | 後述 |

`GOOGLE_CLIENT_ID` はビルド時に `VITE_GOOGLE_CLIENT_ID` として使うので**そのまま残す**。

### Cloudflare API トークンの取得

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → My Profile (右上) → API Tokens
2. **Create Token** → テンプレート一覧から **Cloudflare Pages** を選択
3. Account Resources: 自分のアカウントを選択 → Create Token
4. 表示されたトークンをコピーして `CLOUDFLARE_API_TOKEN` に設定

### Cloudflare Account ID の確認

```bash
npx wrangler whoami
```

または Cloudflare Dashboard にログインすると右サイドバーに **Account ID** が表示される。

---

## Step 8: GitHub Pages を無効化する

DNS が Cloudflare Pages に切り替わったことを確認してから実行する。

### リポジトリ設定から無効化

1. GitHub リポジトリ → **Settings** → **Pages**
2. **Source** を `Deploy from a branch` → **None** に変更
3. **Save**

### gh-pages ブランチの削除（任意）

```bash
git push origin --delete gh-pages
```

---

## Step 9: ローカル開発の動作確認

```bash
# ターミナル1: Vite dev server
npm run dev

# ターミナル2: wrangler で Pages Functions + Vite をまとめて起動
npm run workers:dev
# → http://localhost:8788 でアクセス
```

確認項目:
- [ ] `http://localhost:8788` でログイン画面が表示される
- [ ] 「Sign in with Google」→ Google の同意画面にリダイレクトされる
- [ ] 同意後に日記画面が表示される
- [ ] DevTools → Application → Cookies に `grass_session`（HttpOnly フラグあり）が存在する
- [ ] DevTools → Network で `googleapis.com` への直接リクエストがなく、`/api/drive/*` 経由になっている

---

## Step 10: 本番確認

```bash
# ログイン後、KV にセッションが作成されているか確認
npx wrangler kv:key list --binding=SESSIONS --namespace-id=<本番KV ID>

# ログアウト後、セッションが削除されているか確認（上のリストから消えること）
```

`https://grasspuffer.europeanplaice.com` でSign inし、日記の読み書きが正常に動作すれば移行完了。

---

## まとめ：実行順序チェックリスト

```
[ ] 1. npx wrangler login
[ ] 2. npx wrangler kv:namespace create SESSIONS
[ ] 3. npx wrangler kv:namespace create SESSIONS --preview
[ ] 4. wrangler.toml に KV ID を記入してコミット
[ ] 5. npm run build && npx wrangler pages deploy dist --project-name=grass-puffer
[ ] 6. wrangler pages secret put × 3 (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / SESSION_DOMAIN)
[ ] 7. Cloudflare Dashboard でカスタムドメイン grasspuffer.europeanplaice.com を設定
[ ] 8. DNS の CNAME を GitHub Pages → grass-puffer.pages.dev に変更
[ ] 9. Google Cloud Console: Redirect URI に https://grasspuffer.europeanplaice.com/auth/callback を追加
[ ] 10. GitHub Secrets に CLOUDFLARE_API_TOKEN と CLOUDFLARE_ACCOUNT_ID を追加
[ ] 11. main ブランチに merge して CI デプロイを確認
[ ] 12. 動作確認後、GitHub Pages を無効化
```

---

## トラブルシューティング

### ローカルで callback が動かない

Google Cloud Console の Authorized redirect URIs に `http://localhost:8788/auth/callback` が追加されているか確認。

### `SESSION_DOMAIN` の設定ミスでcookieが保存されない

`SESSION_DOMAIN` はスキームなしのホスト名のみ:
- ✅ `grasspuffer.europeanplaice.com`
- ❌ `https://grasspuffer.europeanplaice.com`

### DNS 変更後もまだ GitHub Pages が表示される

DNS キャッシュが残っている。以下で伝播状況を確認:

```bash
dig grasspuffer.europeanplaice.com CNAME
# Cloudflare Pages のアドレスになっていれば OK
```

### KV が見つからないエラー

`wrangler.toml` の `id` / `preview_id` が `REPLACE_WITH_*` のままになっていないか確認。
