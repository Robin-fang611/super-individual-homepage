# automation-1785998345912 · ink-loop visual verification

## health-01 (2026-08-06 14:56 CST)
- Branch auto/design-loop checked out + pulled (was behind? no, up to date).
- Static server `python3 -m http.server 8789` → HTTP 200.
- Capture: initial attempt with `chrome-headless-shell --screenshot --virtual-time-budget=6000` hung (~3 min, never wrote PNG) because the homepage runs a continuous WebGL animation that keeps virtual time from advancing. Switched to puppeteer-core (cached chrome 150.0.7871.24, headless 'shell', `--enable-unsafe-swiftshader`) for reliable capture.
- Result: HTTP 200, consoleErrors=0, pageErrors=0, requestfailed=0. Screenshot docs/loop/shots/health-01.png (1280x800, 654KB, non-blank).
- Verdict: PASS.
- Committed `docs/loop/` and pushed to origin auto/design-loop only (commit 5eee7b7). main untouched.

## Operational notes
- Reliable capture recipe: puppeteer-core + executablePath to the cached chrome-headless-shell + `waitUntil:'load'` then 3.5s settle, then screenshot. Avoid `--virtual-time-budget` on this animated page.
- `git add docs/loop/` sweeps pre-existing loop artifacts (baseline*.png, realm-inner.png, last-smoke.json, server.log) too — acceptable since they are loop outputs.
- Next health number: increment max existing health-NN.md.
