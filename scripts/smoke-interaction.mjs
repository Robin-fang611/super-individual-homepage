// Interaction-level smoke test for the Ink-Universe three-realm homepage.
// Drives a real (headless) browser to click the realm pills, expand inner
// thoughts, and submit stardust — verifying actual behaviour, not just paint.
//
// Uses puppeteer-core (managed node workspace only). The browser binary is the
// cached chrome-headless-shell, discovered via PUPPETEER_EXECUTABLE_PATH or a
// default mac_arm path. Zero effect on the website's runtime dependencies.
//
// Usage:
//   node scripts/smoke-interaction.mjs [--url http://localhost:8788] \
//        [--shots-dir docs/loop/shots] [--out report.json]
//
// Exit code: 0 = all checks passed; 1 = a blocking failure.

import puppeteer from "/Users/onebilion/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// --- args -------------------------------------------------------------------
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

// --- harness -----------------------------------------------------------------
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
  await page.waitForSelector("#realm-nav .realm-pill", { timeout: 15000 });
  // Wait for app init to finish (realm switch writes data-realm="road").
  await page.waitForFunction(() => document.querySelector("#universe-app")?.dataset.realm, { timeout: 15000 });

  // 1) default realm = road
  const realm0 = await page.$eval("#universe-app", (el) => el.dataset.realm);
  check("default realm is road", realm0 === "road", `data-realm=${realm0}`);
  const innerHidden0 = await page.$eval("#realm-inner", (el) => el.hidden);
  const interHidden0 = await page.$eval("#realm-interactive", (el) => el.hidden);
  check("inner & interactive layers hidden on road", innerHidden0 && interHidden0);

  // 2) switch to inner
  await page.click('.realm-pill[data-realm="inner"]');
  await page.waitForFunction(() => document.querySelector("#universe-app").dataset.realm === "inner", { timeout: 5000 });
  const realm1 = await page.$eval("#universe-app", (el) => el.dataset.realm);
  check("switch to inner", realm1 === "inner", `data-realm=${realm1}`);
  const innerShown = await page.$eval("#realm-inner", (el) => !el.hidden);
  check("inner layer visible", innerShown);
  await page.waitForSelector("#inner-thoughts .inner-thought", { timeout: 5000 });
  const thoughtCount = await page.$$eval("#inner-thoughts .inner-thought", (els) => els.length);
  check("inner thoughts loaded", thoughtCount > 0, `${thoughtCount} cards`);
  if (SHOTS_DIR) {
    mkdirSync(SHOTS_DIR, { recursive: true });
    await page.screenshot({ path: join(SHOTS_DIR, "realm-inner.png") });
  }

  // 3) expand first inner thought
  await page.click("#inner-thoughts .inner-thought");
  await page.waitForFunction(
    () => !document.querySelector("#inner-thoughts .inner-thought .inner-thought__body")?.hasAttribute("hidden"),
    { timeout: 5000 }
  );
  const expanded = await page.$eval("#inner-thoughts .inner-thought", (card) =>
    card.classList.contains("is-open")
  );
  check("inner thought expands on click", expanded);

  // 4) switch to interactive
  await page.click('.realm-pill[data-realm="interactive"]');
  await page.waitForFunction(() => document.querySelector("#universe-app").dataset.realm === "interactive", { timeout: 5000 });
  const realm2 = await page.$eval("#universe-app", (el) => el.dataset.realm);
  check("switch to interactive", realm2 === "interactive", `data-realm=${realm2}`);
  const interShown = await page.$eval("#realm-interactive", (el) => !el.hidden);
  check("interactive layer visible", interShown);
  await page.waitForSelector("#stardust-cloud .stardust-chip", { timeout: 5000 });
  const seedCount = await page.$$eval("#stardust-cloud .stardust-chip", (els) => els.length);
  check("stardust seed chips rendered", seedCount >= 3, `${seedCount} chips`);
  if (SHOTS_DIR) await page.screenshot({ path: join(SHOTS_DIR, "realm-interactive.png") });

  // 5) submit a new stardust
  const before = seedCount;
  const message = `自动化冒烟 ${new Date().toISOString()}`;
  await page.type("#stardust-input", message);
  await page.click('#stardust-form button[type="submit"]');
  await page.waitForFunction(
    (msg) => {
      const chips = [...document.querySelectorAll("#stardust-cloud .stardust-chip")];
      return chips.some((c) => c.textContent.includes(msg));
    },
    { timeout: 5000 },
    message
  );
  const after = await page.$$eval("#stardust-cloud .stardust-chip", (els) => els.length);
  check("stardust submit adds a chip", after === before + 1, `${before} -> ${after}`);

  // 6) back to road
  await page.click('.realm-pill[data-realm="road"]');
  await page.waitForFunction(() => document.querySelector("#universe-app").dataset.realm === "road", { timeout: 5000 });
  check("switch back to road", (await page.$eval("#universe-app", (el) => el.dataset.realm)) === "road");
  if (SHOTS_DIR) await page.screenshot({ path: join(SHOTS_DIR, "realm-road.png") });

  // --- gates -----------------------------------------------------------------
  check("no uncaught page errors", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 300));
  check("no console errors (non-GPU)", consoleErrors.length === 0, consoleErrors.join(" | ").slice(0, 300));
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
