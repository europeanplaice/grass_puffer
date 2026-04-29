# Grass Puffer — Google Drive Diary

A minimalist personal diary app that runs entirely in the browser. No server, no database — entries are stored as JSON files in your own Google Drive.

**[→ Open the app](https://europeanplaice.github.io/grass_puffer/)**

## Features

- Write and save daily diary entries
- Calendar view to navigate by date
- Full-text search across all entries
- Data stays in your Google Drive (`GrassPuffer Diary/` folder)
- Works on mobile with a drawer sidebar
- Installable as a Progressive Web App

## How it works

- Auth: Google Identity Services (OAuth 2.0 implicit grant, `drive.file` scope)
- Storage: Google Drive API v3 — one JSON file per entry (`diary-YYYY-MM-DD.json`)
- No backend, no cookies, no analytics
- Access tokens are kept in memory only and never persisted
- The app shell is cached by a service worker. Google sign-in and Drive
  read/write operations still require a network connection.

## Self-hosting

If you want to deploy your own instance:

### 1. Fork this repository

### 2. Set up a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project and enable the **Google Drive API**
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Add your GitHub Pages URL to **Authorized JavaScript origins**:
   ```
   https://<your-username>.github.io
   ```
6. Copy the **Client ID**

### 3. Configure the repository

- Add the Client ID as a repository secret named `GOOGLE_CLIENT_ID`
  (Settings → Secrets and variables → Actions → New repository secret)
- Update `vite.config.ts` — change `base` to match your repo name:
  ```ts
  base: '/<your-repo-name>/',
  ```

### 4. Enable GitHub Pages

- Go to Settings → Pages
- Source: **GitHub Actions**

Push to `main` and the app will be deployed automatically.

### Local development

```bash
cp .env.local.example .env.local   # or create manually
# add: VITE_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com

npm install
npm run dev
```

> Note: Google OAuth requires the origin to be registered. For local dev, add `http://localhost:5173` to your OAuth client's Authorized JavaScript origins.

## Tech stack

- React + TypeScript
- Vite
- Google Identity Services
- Google Drive API v3 (plain `fetch`, no SDK)
- GitHub Actions + GitHub Pages
