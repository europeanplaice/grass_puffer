import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const url = process.argv[2] ?? process.env.LIGHTHOUSE_URL ?? 'http://localhost:8788'
const port = Number(process.env.LIGHTHOUSE_DEBUG_PORT ?? 9222)
const outputPath = process.env.LIGHTHOUSE_OUTPUT_PATH ?? './test-results/lighthouse-local'

const browser = await chromium.launch({
  headless: true,
  args: [
    `--remote-debugging-port=${port}`,
    '--no-sandbox',
    '--disable-gpu',
  ],
})

const command = 'pnpm'
const args = [
  'dlx',
  'lighthouse',
  url,
  '--port',
  String(port),
  '--output=json',
  '--output=html',
  `--output-path=${outputPath}`,
]

const child = spawn(command, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    TMPDIR: process.env.TMPDIR ?? '/tmp',
  },
})

const exitCode = await new Promise((resolve) => {
  child.on('exit', (code) => resolve(code ?? 1))
  child.on('error', () => resolve(1))
})

await browser.close()
process.exit(exitCode)
