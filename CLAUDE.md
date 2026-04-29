# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start local dev server (Vite HMR)
npm run build     # type-check + production build → dist/
npm run preview   # preview the production build locally
```

Requires a `.env.local` with `VITE_GOOGLE_CLIENT_ID=<id>.apps.googleusercontent.com` to work against real Google Drive.

## Architecture

Frontend-only React + TypeScript SPA, deployed to GitHub Pages via `.github/workflows/deploy.yml`. No backend. All diary data lives in the user's Google Drive.

### Auth flow (`src/api/gauth.ts`)
Uses **Google Identity Services (GIS) token model** (implicit grant). A single `<script src="https://accounts.google.com/gsi/client">` in `index.html` provides the global `google.accounts.oauth2` namespace. `initTokenClient()` is called once on app load; `requestAccessToken()` is called on user gesture to show the Google consent popup. Access tokens (~1 hr TTL) are kept in React state only — never `localStorage`.

Scope: `drive.file` — non-sensitive, only accesses files the app creates.

### Drive storage (`src/api/driveEntries.ts`)
All Drive API v3 calls are plain `fetch` with `Authorization: Bearer <token>`. No `gapi.client`. Diary entries are stored as individual JSON files in a folder named `GrassPuffer Diary` in the user's Drive:

```
/GrassPuffer Diary/
  diary-YYYY-MM-DD.json   ← { date, content, updated_at }
```

Folder ID is cached in module scope after first lookup. File upload uses `multipart/related` to set both metadata and content in one request.

### State
- `useAuth` (`src/hooks/useAuth.ts`) — wraps `gauth.ts`, exposes `{ accessToken, signIn, signOut }`
- `useDiary` (`src/hooks/useDiary.ts`) — on `accessToken`, calls `ensureFolder` + `listEntries`; lazily fetches content per entry into a `Map<date, EntryCache>`; exposes `{ dates, getContent, save, remove, search }`

### Components
- `LoginScreen` — shown when `accessToken` is null
- `App` — sidebar + main panel layout
- `CalendarView` — monthly grid built with native `Date` arithmetic; dots on dates with entries
- `EntryEditor` — `<textarea>`, save/delete; Ctrl+S triggers save
- `SearchBar` — client-side full-text search across loaded entry content

### Deployment
`vite.config.ts` sets `base: '/grass_puffer/'` (must match repo name). GitHub Actions builds with `VITE_GOOGLE_CLIENT_ID` from repo secret and deploys `dist/` to `gh-pages` branch.

### Google Cloud setup (one-time)
1. Enable Google Drive API in a GCP project
2. Create OAuth 2.0 credentials → Web Application
3. Add `https://<username>.github.io` to **Authorized JavaScript origins** (no redirect URI needed)
4. Store the Client ID in `.env.local` locally and as repo secret `GOOGLE_CLIENT_ID`
