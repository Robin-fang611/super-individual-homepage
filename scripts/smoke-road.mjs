// Road-only smoke test for the Ink-Universe homepage (post 互动/内心 removal).
// Drives a real (headless) browser to confirm the star map still boots, the
// proximity-interaction prompt element exists, and nothing throws on load.
// Replaces the old scripts/smoke-interaction.mjs (which tested removed realms).
//
// Uses puppeteer-core (managed node workspace only). The browser binary is the
// cached chrome-headless-shell, discovered via PUPPETEER_EXECUTABLE_PATH or a
// default mac_arm path. Zero effect on the website's runtime dependencies.
//
// Usage:
//   node scripts/smoke-road.mjs [--url http://localhost:8788] \
//        [--shots-dir docs/loop/shots] [--out report.json]
//
// Exit code: 0 = all checks passed; 1 = a blocking failure.

import puppeteer from "/Users/onebilion/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const URL = getArg("--url", "http://localhost:8788");
const SHOTS_DIR = getArg("--shots-dir", null);
const OUT = getArg("--out", null);

const EXECUTABLE =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "/Users/onebilion/.cache/puppeteer/chrome-headless-shell/mac_arm-150.0.7871.24/chrome-headless-shell-mac-arm64/chrome-headless-shell";

// Console noise that is an environment limitation (headless has no GPU/WebGL),
// not a code defect. Reported but never blocks the run.
const BENIGN = /gpu|webgl|gl_|GLES|swiftshader|GroupMarker|fontconfig|deprecated|Failed to create WebGL|getContext/i;

const results = [];
const consoleErrors = [];
const pageErrors = [];
let browser;

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`[${tag}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  browser = await puppeteer.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--hide-scrollbars"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!BENIGN.test(text)) consoleErrors.push(text);
    }
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (!/favicon/.test(url)) pageErrors.push(`requestfailed: ${url} (${req.failure()?.errorText})`);
  });

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });

  // 1) app boots to ready (a thrown error during init would land on fallback)
  await page.waitForFunction(
    () => {
      const boot = window.__universeBoot;
      return boot && (boot.step === "ready" || boot.step === "error");
    },
    { timeout: 20000 },
  );
  const step = await page.$eval("#universe-app", () => window.__universeBoot?.step);
  check("app booted without throwing", step === "ready", `step=${step}`);

  // 2) proximity-interaction prompt element exists and starts hidden
  const promptInfo = await page.evaluate(() => {
    const el = document.querySelector("#interact-prompt");
    return el ? { exists: true, hidden: el.hidden } : { exists: false };
  });
  check("interact-prompt element present", promptInfo.exists);
  check("interact-prompt hidden on load", promptInfo.exists && promptInfo.hidden === true);

  // 3) no uncaught page / console errors (non-GPU)
  check("no uncaught page errors", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
  check("no console errors (non-GPU)", consoleErrors.length === 0, consoleErrors.join(" | ").slice(0, 300));

  if (SHOTS_DIR) {
    mkdirSync(SHOTS_DIR, { recursive: true });
    await page.screenshot({ path: join(SHOTS_DIR, "realm-road.png") });
  }
}

try {
  await main();
} catch (err) {
  check("script executed without throwing", false, String(err).slice(0, 300));
} finally {
  if (browser) await browser.close();
}

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
const summary = {
  url: URL,
  total: results.length,
  passed,
  failed,
  ok: failed === 0,
  checks: results,
  consoleErrors,
  pageErrors,
};
console.log(`\nSUMMARY: ${passed}/${results.length} passed, ok=${summary.ok}`);
if (OUT) {
  writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(`report written to ${OUT}`);
}
process.exit(summary.ok ? 0 : 1);
