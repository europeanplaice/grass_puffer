# Grass Puffer — Google Drive Diary

A minimalist personal diary app that runs entirely in the browser. No server, no database — entries are stored as JSON files in your own Google Drive.

**[-> Open the app](https://grasspuffer.europeanplaice.com/)**

## Features

- Write daily diary entries, with manual save via button or Ctrl/Cmd+S
- Optional Drive auto-save after a few seconds of editing
- Calendar view to navigate by date, with dots marking days that have entries
- Previous/next day controls, plus Alt+Left / Alt+Right and Alt+Up for today
- Full-text search across indexed entries, with background indexing progress
- Recent-entry list with first-line previews
- Delete entries with an explicit confirmation step
- Detect cross-device edit conflicts and choose whether to load latest, keep local edits, or overwrite
- View and restore past revisions of an entry
- Export all entries as a JSON file
- Settings modal for theme and font customization
- Data stays in your Google Drive (`GrassPuffer Diary/` folder), one JSON file per day
- Warns before reload or date changes when there are unsaved edits
- Works on mobile with a drawer sidebar, Android back-button support, and keyboard-aware layout
- Installable as a Progressive Web App

## How it works

- Auth: Google Identity Services (OAuth 2.0 implicit grant, `drive.file` scope)
- Storage: Google Drive API v3 — one JSON file per entry (`diary-YYYY-MM-DD.json`)
- Saves are serialized per date, and Drive 429/5xx responses are retried with backoff
- No backend, no cookies, no analytics
- Access tokens are kept in memory only and never persisted
- A small `localStorage` flag remembers that a previous Google session may be restorable;
  it does not store the token or diary content.
- The auto-save preference is stored in `localStorage` under `grass_puffer_autosave`.
- Theme and font preferences are also stored in `localStorage`.
- The app shell is cached by a service worker in production. Google sign-in and Drive
  read/write operations still require a network connection.
- Production builds inject a Content Security Policy that limits network access to the
  app itself and Google OAuth/Drive endpoints.

## Self-hosting

If you want to deploy your own instance:

### 1. Fork this repository

### 2. Set up a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project and enable the **Google Drive API**
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Add your production origin to **Authorized JavaScript origins**:
   ```
   https://<your-domain>
   ```
   For GitHub project pages, this is usually `https://<your-username>.github.io`.
6. Copy the **Client ID**

### 3. Configure the repository

- Add the Client ID as a repository secret named `GOOGLE_CLIENT_ID`
  (Settings → Secrets and variables → Actions → New repository secret)
- `vite.config.ts` currently uses `base: '/'`, which is correct for a custom domain
  or user/organization GitHub Pages site.
- If you deploy to GitHub project pages instead, change `base` to match your repo name:
  ```ts
  base: '/<your-repo-name>/',
  ```
- If you are not using the bundled custom domain, remove or replace `public/CNAME`.

### 4. Enable GitHub Pages

- Go to Settings → Pages
- Source: **GitHub Actions**

Push to `main` and the app will be deployed automatically.

### Local development

```bash
printf 'VITE_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com\n' > .env.local

npm install
npm run dev       # Vite dev server with HMR
npm run build     # type-check + production build → dist/
npm run preview   # serve the production build locally
npm test          # run the Playwright test suite
```

> Note: Google OAuth requires the origin to be registered. For local dev, add `http://localhost:5173` to your OAuth client's Authorized JavaScript origins.

## Tech stack

- React 19 + TypeScript
- Vite 8
- Google Identity Services (token model)
- Google Drive API v3 (plain `fetch`, no `gapi.client` SDK)
- Playwright for component and integration tests
- GitHub Actions + GitHub Pages
