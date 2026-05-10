# Lighthouse Performance Check

Last verified: 2026-05-10

This project can run Lighthouse through a Playwright-launched Chromium browser. The wrapper script is:

```sh
node scripts/lighthouse-playwright.mjs <url>
```

It starts Chromium with a remote debugging port, then runs `pnpm dlx lighthouse` against that browser. Reports are written under `test-results/` by default.

## Production Bundle Measurement

Use the production bundle for performance numbers. The Vite dev server includes React development builds, React Refresh, and Vite client code, so dev-server scores are not representative.

```sh
npm run build
npx vite preview --host 127.0.0.1 --port 4173
LIGHTHOUSE_DEBUG_PORT=9226 LIGHTHOUSE_OUTPUT_PATH=./test-results/lighthouse-production-vite node scripts/lighthouse-playwright.mjs http://127.0.0.1:4173
```

After the run, stop the temporary preview server.

Generated files:

```txt
test-results/lighthouse-production-vite.report.html
test-results/lighthouse-production-vite.report.json
```

## Latest Baseline

Measured against `http://127.0.0.1:4173/` on 2026-05-10:

```txt
Performance: 91
Accessibility: 88
Best Practices: 100
SEO: 82
FCP: 2.5 s
LCP: 2.8 s
TBT: 120 ms
CLS: 0.012
Speed Index: 2.5 s
TTI: 2.9 s
```

Build output at that time:

```txt
dist/index.html                   1.31 kB, gzip 0.59 kB
dist/assets/index-BztjJE1G.css   36.64 kB, gzip 7.04 kB
dist/assets/index-EB2Pz4iI.js   510.14 kB, gzip 157.92 kB
```

## Known Local Server Notes

`npm run dev` / Vite dev server can be audited, but expect much lower scores because the page loads dev-only modules.

`wrangler pages dev dist` and `wrangler pages dev --proxy 5173` responded to `curl`, but Lighthouse navigation failed locally with:

```txt
net::ERR_ABORTED
```

For local production-bundle performance checks, prefer `npx vite preview` unless the Cloudflare runtime itself is the subject of the test.

## Remaining Improvement Signals

The latest production-bundle report still showed:

```txt
Unused JavaScript: about 97 KiB
Unused Google Fonts CSS: about 61 KiB
Missing meta description
Invalid robots.txt response, likely HTML fallback
Login screen contrast issue for #777 text on white
```
