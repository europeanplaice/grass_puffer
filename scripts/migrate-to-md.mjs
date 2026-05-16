#!/usr/bin/env node
/**
 * One-time migration: converts diary-YYYY-MM-DD.json files in Google Drive
 * to diary-YYYY-MM-DD.md with YAML frontmatter.
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/migrate-to-md.mjs
 */

import http from 'http'
import { randomBytes, createHash } from 'crypto'
import { exec } from 'child_process'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const PORT = 14321
const REDIRECT_URI = `http://localhost:${PORT}/callback`
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const BASE = 'https://www.googleapis.com/drive/v3'
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_NAME = 'linger_diary'

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set.')
  process.exit(1)
}

// --- PKCE helpers ---

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pkce() {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

// --- OAuth flow ---

async function getAccessToken() {
  const { verifier, challenge } = pkce()
  const state = base64url(randomBytes(12))

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPE)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  console.log('\nOpening browser for Google authentication...')
  console.log('If the browser does not open, visit:\n' + authUrl.toString() + '\n')
  openBrowser(authUrl.toString())

  const code = await waitForCode(state)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Token exchange failed: ${body}`)
  }

  const { access_token } = await res.json()
  return access_token
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`
  exec(cmd, () => {})
}

function waitForCode(expectedState) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`)
      if (url.pathname !== '/callback') return

      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<html><body><p>Authentication complete. You can close this tab.</p></body></html>')
      server.close()

      if (error) return reject(new Error(`OAuth error: ${error}`))
      if (state !== expectedState) return reject(new Error('State mismatch'))
      resolve(code)
    })

    server.listen(PORT, '127.0.0.1', () => {})
    server.on('error', reject)
    setTimeout(() => { server.close(); reject(new Error('Timed out waiting for OAuth callback (2 min)')) }, 120_000)
  })
}

// --- Drive helpers ---

function headers(token, extra) {
  return { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache', ...extra }
}

async function driveGet(token, url) {
  const res = await fetch(url, { headers: headers(token) })
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function findFolder(token) {
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`)
  const { files } = await driveGet(token, `${BASE}/files?q=${q}&fields=files(id)`)
  if (!files.length) throw new Error(`Folder "${FOLDER_NAME}" not found in Drive.`)
  return files[0].id
}

async function listJsonFiles(token, folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType='application/json'`)
  const { files } = await driveGet(token, `${BASE}/files?q=${q}&fields=${encodeURIComponent('files(id,name)')}&pageSize=1000`)
  return files.filter(f => /^diary-\d{4}-\d{2}-\d{2}\.json$/.test(f.name))
}

async function mdExists(token, folderId, date) {
  const name = `diary-${date}.md`.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and name='${name}'`)
  const { files } = await driveGet(token, `${BASE}/files?q=${q}&fields=${encodeURIComponent('files(id)')}&pageSize=1`)
  return files.length > 0
}

async function readJson(token, fileId) {
  const res = await fetch(`${BASE}/files/${fileId}?alt=media`, { headers: headers(token) })
  if (!res.ok) throw new Error(`Read failed: ${res.status}`)
  return res.json()
}

function toMarkdown(entry) {
  return `---\ndate: ${entry.date}\nupdated_at: ${entry.updated_at}\n---\n\n${entry.content}`
}

async function createMd(token, folderId, date, body) {
  const boundary = 'migrate_boundary'
  const multipart = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name: `diary-${date}.md`, mimeType: 'text/plain', parents: [folderId] }),
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
    `--${boundary}--`,
  ].join('\r\n')

  const res = await fetch(`${UPLOAD_BASE}/files?uploadType=multipart`, {
    method: 'POST',
    headers: headers(token, { 'Content-Type': `multipart/related; boundary=${boundary}` }),
    body: multipart,
  })
  if (!res.ok) throw new Error(`Create failed: ${res.status}: ${await res.text()}`)
}

async function deleteFile(token, fileId) {
  const res = await fetch(`${BASE}/files/${fileId}`, { method: 'DELETE', headers: headers(token) })
  if (!res.ok && res.status !== 404) throw new Error(`Delete failed: ${res.status}`)
}

// --- Main ---

async function main() {
  const token = await getAccessToken()
  console.log('Authenticated.\n')

  const folderId = await findFolder(token)
  const jsonFiles = await listJsonFiles(token, folderId)

  if (jsonFiles.length === 0) {
    console.log('No .json diary files found. Nothing to migrate.')
    return
  }

  console.log(`Found ${jsonFiles.length} file(s) to migrate.\n`)

  let migrated = 0
  let skipped = 0
  const errors = []

  for (const file of jsonFiles) {
    const date = file.name.replace('diary-', '').replace('.json', '')
    process.stdout.write(`  ${file.name} → `)

    try {
      if (await mdExists(token, folderId, date)) {
        await deleteFile(token, file.id)
        console.log('skipped (md exists, deleted json)')
        skipped++
      } else {
        const entry = await readJson(token, file.id)
        await createMd(token, folderId, date, toMarkdown(entry))
        await deleteFile(token, file.id)
        console.log(`diary-${date}.md`)
        migrated++
      }
    } catch (e) {
      console.log(`ERROR: ${e.message}`)
      errors.push({ name: file.name, error: e.message })
    }
  }

  console.log(`\nDone. migrated=${migrated}, skipped=${skipped}, errors=${errors.length}`)
  if (errors.length) {
    console.error('\nFailed files:')
    errors.forEach(e => console.error(`  ${e.name}: ${e.error}`))
    process.exit(1)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
