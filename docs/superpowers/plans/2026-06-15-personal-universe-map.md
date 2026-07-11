# Personal Universe Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable front-end loop for Robin's personal universe map: black intro, pure starfield exploration, serious 2.5D parallax dragging, discoverable record nodes, and starfield-backed reading mode.

**Architecture:** Keep the current static site and ES module setup. Replace the current star-road runtime at the app entry with focused modules for intro, content loading, universe layout math, canvas rendering, record-node interaction, and reading overlay. Do not delete old star-road modules in this pass; leave cleanup for a separate explicit decision.

**Tech Stack:** Static HTML/CSS, browser ES modules, Canvas 2D for the 2.5D universe map, existing Markdown-frontmatter parsing style, Node built-in test runner.

---

## Ground Rules

- Do not add npm, pnpm, yarn, or other dependencies.
- Do not delete old files in this implementation pass.
- Do not commit unless Robin explicitly asks. This plan intentionally uses verification checkpoints instead of commit steps.
- Exploration state must show no text, labels, years, nav, or obvious buttons.
- First pass uses pure test records. Real content is not part of this implementation.

## File Structure

- Modify: `index.html` - replace the old star-road shell with the intro, universe canvas, and reading overlay shell.
- Modify: `styles.css` - replace old star-road UI styles with intro, pure exploration, hidden controls, and reading overlay styles.
- Modify: `src/app.mjs` - orchestrate intro, content loading, universe scene, node selection, and reading overlay.
- Create: `src/record-content.mjs` - parse, validate, sort, and load record Markdown files.
- Create: `src/universe-layout.mjs` - deterministic starfield, record node placement, parallax math, drag bounds, and hit testing.
- Create: `src/intro-controller.mjs` - intro phase timing and DOM class management.
- Create: `src/reading-overlay.mjs` - render selected Markdown record into a starfield-backed reading mode.
- Create: `src/universe-scene.mjs` - Canvas 2D rendering loop, pointer dragging, parallax drawing, node reveal, and node selection.
- Create: `content/records/index.json` - manifest for test records.
- Create: `content/records/2026-06-15-test-signal.md` - test record.
- Create: `content/records/2025-01-01-test-memory.md` - test record.
- Create: `content/records/2024-01-01-test-origin.md` - test record.
- Create: `tests/record-content.test.mjs` - content parser and sorting tests.
- Create: `tests/universe-layout.test.mjs` - deterministic layout, parallax, bounds, and hit-test tests.
- Create: `tests/intro-controller.test.mjs` - intro timing phase tests.
- Create: `tests/app-shell.test.mjs` - static shell checks for no exploration text/nav.
- Keep: `src/star-field.mjs`, `src/star-layout.mjs`, `src/star-content.mjs`, and existing tests untouched unless they fail because of entrypoint changes.

## Task 1: Record Content Contract

**Files:**
- Create: `src/record-content.mjs`
- Create: `tests/record-content.test.mjs`
- Create: `content/records/index.json`
- Create: `content/records/2026-06-15-test-signal.md`
- Create: `content/records/2025-01-01-test-memory.md`
- Create: `content/records/2024-01-01-test-origin.md`

- [ ] **Step 1: Write failing record-content tests**

Create `tests/record-content.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  parseRecordMarkdown,
  sortRecordsByDate,
  validateRecord,
} from "../src/record-content.mjs";

test("parses a flexible markdown record with frontmatter", () => {
  const record = parseRecordMarkdown(
    `---
title: "测试星体"
date: "2026-06-15"
type: "thought"
summary: "用于验证阅读模式的测试记录。"
importance: 0.9
visibility: "public"
---

这里是正文。
`,
    "2026-06-15-test-signal.md",
  );

  assert.equal(record.id, "2026-06-15-test-signal.md");
  assert.equal(record.title, "测试星体");
  assert.equal(record.date, "2026-06-15");
  assert.equal(record.type, "thought");
  assert.equal(record.summary, "用于验证阅读模式的测试记录。");
  assert.equal(record.importance, 0.9);
  assert.equal(record.visibility, "public");
  assert.equal(record.body, "这里是正文。");
});

test("allows optional fields without producing empty template values", () => {
  const record = parseRecordMarkdown(
    `---
title: "只有正文"
date: "2025-01-01"
visibility: "public"
---

自由记录正文。
`,
    "2025-01-01-test-memory.md",
  );

  assert.equal(record.type, "");
  assert.equal(record.summary, "");
  assert.equal(record.importance, 0.5);
  assert.equal(record.body, "自由记录正文。");
});

test("rejects records missing title, date, visibility, or body", () => {
  assert.throws(
    () => validateRecord({ title: "缺日期", visibility: "public", body: "x" }),
    /Missing required record field: date/,
  );

  assert.throws(
    () => validateRecord({ title: "缺正文", date: "2026-01-01", visibility: "public", body: "" }),
    /Missing required record body/,
  );
});

test("sorts records newest first", () => {
  const records = [
    { title: "old", date: "2024-01-01", visibility: "public", body: "old" },
    { title: "new", date: "2026-01-01", visibility: "public", body: "new" },
    { title: "mid", date: "2025-01-01", visibility: "public", body: "mid" },
  ];

  assert.deepEqual(
    sortRecordsByDate(records).map((record) => record.title),
    ["new", "mid", "old"],
  );
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
node --test tests/record-content.test.mjs
```

Expected result: FAIL with a module-not-found error for `src/record-content.mjs`.

- [ ] **Step 3: Implement record content parsing**

Create `src/record-content.mjs`:

```js
const REQUIRED_FIELDS = ["title", "date", "visibility"];

export function parseFrontmatterValue(value) {
  const trimmed = String(value).trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  return trimmed;
}

export function validateRecord(record) {
  for (const field of REQUIRED_FIELDS) {
    if (record[field] === undefined || record[field] === null || record[field] === "") {
      throw new Error(`Missing required record field: ${field}`);
    }
  }

  if (Number.isNaN(Date.parse(record.date))) {
    throw new Error(`Invalid record date: ${record.date}`);
  }

  if (!String(record.body ?? "").trim()) {
    throw new Error("Missing required record body");
  }

  return record;
}

export function parseRecordMarkdown(markdown, file = "inline.md") {
  const source = String(markdown).replace(/^\uFEFF/, "");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!match) {
    throw new Error(`Missing frontmatter in ${file}`);
  }

  const [, frontmatter, body] = match;
  const fields = {};

  for (const line of frontmatter.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) {
      throw new Error(`Invalid frontmatter line in ${file}: ${line}`);
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);
    fields[key] = parseFrontmatterValue(value);
  }

  const importance = Number(fields.importance ?? 0.5);

  return validateRecord({
    id: file,
    file,
    title: fields.title,
    date: fields.date,
    type: fields.type ?? "",
    summary: fields.summary ?? "",
    importance: Number.isFinite(importance) ? Math.min(Math.max(importance, 0), 1) : 0.5,
    visibility: fields.visibility,
    body: body.trim(),
  });
}

export function sortRecordsByDate(records) {
  return [...records].sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
}

export async function loadRecords(manifestUrl = "/content/records/index.json") {
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok) {
    throw new Error(`Failed to load record manifest: ${manifestResponse.status}`);
  }

  const files = await manifestResponse.json();
  const baseUrl = manifestUrl.slice(0, manifestUrl.lastIndexOf("/") + 1);
  const records = [];

  for (const file of files) {
    const response = await fetch(`${baseUrl}${file}`);
    if (!response.ok) {
      throw new Error(`Failed to load record file ${file}: ${response.status}`);
    }

    const record = parseRecordMarkdown(await response.text(), file);
    if (record.visibility === "public") {
      records.push(record);
    }
  }

  return sortRecordsByDate(records);
}
```

- [ ] **Step 4: Add pure test records**

Create `content/records/index.json`:

```json
[
  "2026-06-15-test-signal.md",
  "2025-01-01-test-memory.md",
  "2024-01-01-test-origin.md"
]
```

Create `content/records/2026-06-15-test-signal.md`:

```markdown
---
title: "测试信号"
date: "2026-06-15"
type: "test"
summary: "这是用于验证阅读模式的测试节点。"
importance: 0.9
visibility: "public"
---

这是一条测试记录。它只用于验证星空节点能否打开阅读模式，后续会替换为真实内容。
```

Create `content/records/2025-01-01-test-memory.md`:

```markdown
---
title: "测试回声"
date: "2025-01-01"
type: "test"
summary: "这是用于验证时间排布的测试节点。"
importance: 0.62
visibility: "public"
---

这是一条较早的测试记录。它用于确认旧记录会分布到星河更远的位置。
```

Create `content/records/2024-01-01-test-origin.md`:

```markdown
---
title: "测试起点"
date: "2024-01-01"
type: "test"
summary: "这是用于验证远端节点的测试记录。"
importance: 0.48
visibility: "public"
---

这是一条远端测试记录。它用于确认星河远处仍然可探索，不出现空白星海。
```

- [ ] **Step 5: Verify record tests pass**

Run:

```powershell
node --test tests/record-content.test.mjs
```

Expected result: PASS.

## Task 2: Universe Layout Math

**Files:**
- Create: `src/universe-layout.mjs`
- Create: `tests/universe-layout.test.mjs`

- [ ] **Step 1: Write failing universe layout tests**

Create `tests/universe-layout.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  clampPan,
  createBackgroundStars,
  createRecordNodes,
  getParallaxOffset,
  hitTestNode,
} from "../src/universe-layout.mjs";

const records = [
  { id: "new", title: "New", date: "2026-01-01", importance: 0.9 },
  { id: "mid", title: "Mid", date: "2025-01-01", importance: 0.6 },
  { id: "old", title: "Old", date: "2024-01-01", importance: 0.4 },
];

test("creates deterministic dense background stars", () => {
  const first = createBackgroundStars({ count: 6, seed: 7, width: 1200, height: 800 });
  const second = createBackgroundStars({ count: 6, seed: 7, width: 1200, height: 800 });

  assert.deepEqual(first, second);
  assert.equal(first.length, 6);
  assert.ok(first.every((star) => star.x >= -600 && star.x <= 600));
  assert.ok(first.every((star) => star.y >= -400 && star.y <= 400));
});

test("places newer records closer to the foreground side of the main river", () => {
  const nodes = createRecordNodes(records, { width: 2400, height: 1400 });
  const newer = nodes.find((node) => node.id === "new");
  const older = nodes.find((node) => node.id === "old");

  assert.ok(newer.x > older.x);
  assert.ok(newer.radius > older.radius);
  assert.ok(newer.revealRadius > newer.radius);
});

test("calculates layer-specific parallax offsets", () => {
  const pan = { x: 120, y: -80 };

  assert.deepEqual(getParallaxOffset(pan, 0.25), { x: -30, y: 20 });
  assert.deepEqual(getParallaxOffset(pan, 1.15), { x: -138, y: 92 });
});

test("clamps pan with a non-empty exploration range", () => {
  const clamped = clampPan({ x: 9999, y: -9999 }, { width: 2400, height: 1400 }, { width: 1200, height: 800 });

  assert.ok(clamped.x <= 720);
  assert.ok(clamped.y >= -420);
});

test("hit tests only inside a discoverable record node", () => {
  const node = { id: "node", screenX: 100, screenY: 80, revealRadius: 42 };

  assert.equal(hitTestNode([node], { x: 110, y: 90 })?.id, "node");
  assert.equal(hitTestNode([node], { x: 200, y: 180 }), null);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
node --test tests/universe-layout.test.mjs
```

Expected result: FAIL with a module-not-found error for `src/universe-layout.mjs`.

- [ ] **Step 3: Implement universe layout utilities**

Create `src/universe-layout.mjs`:

```js
export function createSeededRng(seed) {
  let value = seed >>> 0;
  return function rng() {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

export function createBackgroundStars({ count, seed, width, height }) {
  const rng = createSeededRng(seed);
  const stars = [];

  for (let index = 0; index < count; index += 1) {
    const layerRoll = rng();
    const layer = layerRoll < 0.5 ? "far" : layerRoll < 0.85 ? "mid" : "near";

    stars.push({
      id: `star-${seed}-${index}`,
      x: (rng() - 0.5) * width,
      y: (rng() - 0.5) * height,
      radius: layer === "near" ? 1.2 + rng() * 1.8 : layer === "mid" ? 0.7 + rng() * 1.2 : 0.35 + rng() * 0.8,
      alpha: layer === "near" ? 0.42 + rng() * 0.48 : layer === "mid" ? 0.25 + rng() * 0.36 : 0.14 + rng() * 0.24,
      warmth: rng() > 0.9 ? 1 : 0,
      layer,
      phase: rng() * Math.PI * 2,
    });
  }

  return stars;
}

export function createRecordNodes(records, { width, height }) {
  const sorted = [...records].sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
  const count = Math.max(1, sorted.length);

  return sorted.map((record, index) => {
    const progress = count === 1 ? 0 : index / (count - 1);
    const riverX = width * (0.34 - progress * 0.68);
    const riverY = Math.sin(progress * Math.PI * 1.5 - 0.35) * height * 0.26;
    const curveNoise = Math.sin(index * 1.91 + 0.42) * height * 0.08;
    const importance = Number.isFinite(record.importance) ? Math.min(Math.max(record.importance, 0), 1) : 0.5;
    const radius = 6 + importance * 8;

    return {
      ...record,
      x: riverX,
      y: riverY + curveNoise,
      radius,
      revealRadius: Math.max(34, radius * 4.4),
      glow: 0.45 + importance * 0.55,
      progress,
    };
  });
}

export function getParallaxOffset(pan, strength) {
  return {
    x: Math.round(-pan.x * strength),
    y: Math.round(-pan.y * strength),
  };
}

export function clampPan(pan, world, viewport) {
  const maxX = Math.max(0, (world.width - viewport.width) * 0.6);
  const maxY = Math.max(0, (world.height - viewport.height) * 0.7);

  return {
    x: Math.min(Math.max(pan.x, -maxX), maxX),
    y: Math.min(Math.max(pan.y, -maxY), maxY),
  };
}

export function hitTestNode(nodes, point) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const node of nodes) {
    const distance = Math.hypot(point.x - node.screenX, point.y - node.screenY);
    if (distance <= node.revealRadius && distance < nearestDistance) {
      nearest = node;
      nearestDistance = distance;
    }
  }

  return nearest;
}
```

- [ ] **Step 4: Verify layout tests pass**

Run:

```powershell
node --test tests/universe-layout.test.mjs
```

Expected result: PASS.

## Task 3: App Shell And Intro Contract

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Create: `src/intro-controller.mjs`
- Create: `tests/intro-controller.test.mjs`
- Create: `tests/app-shell.test.mjs`

- [ ] **Step 1: Write failing intro and shell tests**

Create `tests/intro-controller.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { getIntroPhase } from "../src/intro-controller.mjs";

test("maps intro elapsed time to readable phases", () => {
  assert.equal(getIntroPhase(0), "black");
  assert.equal(getIntroPhase(900), "message");
  assert.equal(getIntroPhase(2400), "collapse");
  assert.equal(getIntroPhase(3600), "reveal");
  assert.equal(getIntroPhase(4600), "done");
});
```

Create `tests/app-shell.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("exploration shell has no visible nav, labels, or years", () => {
  const html = readFileSync("index.html", "utf8");

  assert.match(html, /id="intro-screen"/);
  assert.match(html, /id="universe-canvas"/);
  assert.match(html, /id="reading-overlay"/);
  assert.doesNotMatch(html, /hidden-nav|interaction-hint|星路导航|STAR ROAD|2026/);
});
```

- [ ] **Step 2: Run failing tests**

Run:

```powershell
node --test tests/intro-controller.test.mjs tests/app-shell.test.mjs
```

Expected result: FAIL because `src/intro-controller.mjs` does not exist and `index.html` still contains old star-road UI.

- [ ] **Step 3: Replace HTML shell**

Modify `index.html` to this shell:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Robin 的个人宇宙地图。" />
    <meta name="theme-color" content="#02040b" />
    <title>Robin | 个人宇宙地图</title>
    <link
      rel="icon"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%2302040b'/%3E%3Ccircle cx='32' cy='32' r='4' fill='%23b9f1ff'/%3E%3C/svg%3E"
    />
    <link rel="stylesheet" href="./styles.css?v=universe-map-1" />
  </head>
  <body>
    <main class="universe-app" id="universe-app" aria-label="Robin 的个人宇宙地图">
      <section class="intro-screen" id="intro-screen" aria-live="polite">
        <div class="intro-message" id="intro-message">
          <p>这里是，我的世界</p>
          <p class="intro-signature">——Robin</p>
        </div>
      </section>

      <canvas id="universe-canvas" class="universe-canvas" aria-hidden="true"></canvas>

      <section class="reading-overlay" id="reading-overlay" aria-modal="true" aria-hidden="true">
        <button class="reading-close" id="reading-close" type="button" aria-label="关闭阅读">×</button>
        <article class="reading-content" id="reading-content" tabindex="-1"></article>
      </section>
    </main>

    <noscript>
      <section class="noscript-fallback">
        <h1>Robin | 个人宇宙地图</h1>
        <p>这个页面需要启用 JavaScript 才能展示宇宙地图。</p>
      </section>
    </noscript>

    <script type="module" src="./src/app.mjs?v=universe-map-1"></script>
  </body>
</html>
```

- [ ] **Step 4: Implement intro controller**

Create `src/intro-controller.mjs`:

```js
export function getIntroPhase(elapsedMs) {
  if (elapsedMs < 500) return "black";
  if (elapsedMs < 2100) return "message";
  if (elapsedMs < 3200) return "collapse";
  if (elapsedMs < 4300) return "reveal";
  return "done";
}

export function createIntroController({ introElement, appElement, onDone }) {
  const startTime = performance.now();
  let raf = 0;
  let done = false;

  function applyPhase(phase) {
    introElement.dataset.phase = phase;
    appElement.dataset.intro = phase;

    if (phase === "done" && !done) {
      done = true;
      introElement.setAttribute("aria-hidden", "true");
      onDone?.();
    }
  }

  function tick(time) {
    const phase = getIntroPhase(time - startTime);
    applyPhase(phase);

    if (phase !== "done") {
      raf = requestAnimationFrame(tick);
    }
  }

  raf = requestAnimationFrame(tick);

  return {
    skip() {
      cancelAnimationFrame(raf);
      applyPhase("done");
    },
    destroy() {
      cancelAnimationFrame(raf);
    },
  };
}
```

- [ ] **Step 5: Replace CSS with universe shell styles**

Modify `styles.css` to include these base sections first. Existing old styles can be replaced in this pass because the old shell no longer exists:

```css
:root {
  color-scheme: dark;
  --bg: #02040b;
  --text: #f3f7ff;
  --muted: rgba(226, 237, 255, 0.68);
  --ice: #82dfff;
  --ice-strong: #b9f1ff;
  --gold: #d8b86a;
  --panel: rgba(2, 4, 11, 0.72);
  --border: rgba(185, 241, 255, 0.18);
  --body-font: Inter, "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
}

* { box-sizing: border-box; }

html,
body {
  width: 100%;
  min-height: 100%;
  margin: 0;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: var(--body-font);
}

button { font: inherit; }

.universe-app {
  position: relative;
  width: 100vw;
  height: 100svh;
  overflow: hidden;
  background: var(--bg);
}

.universe-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
  touch-action: none;
}

.universe-canvas:active { cursor: grabbing; }

.intro-screen {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  background: #000;
  transition: opacity 900ms cubic-bezier(0.16, 1, 0.3, 1);
}

.intro-screen[data-phase="done"] {
  opacity: 0;
  pointer-events: none;
}

.intro-message {
  width: min(520px, calc(100vw - 48px));
  color: rgba(244, 250, 255, 0.92);
  font-size: clamp(20px, 4vw, 34px);
  line-height: 1.8;
  letter-spacing: 0;
  transform-origin: center;
  opacity: 0;
}

.intro-screen[data-phase="message"] .intro-message {
  opacity: 1;
  transform: scale(1);
  transition: opacity 700ms ease;
}

.intro-screen[data-phase="collapse"] .intro-message {
  opacity: 0.86;
  transform: scale(0.02);
  filter: blur(3px);
  transition: transform 1000ms cubic-bezier(0.76, 0, 0.24, 1), filter 1000ms, opacity 1000ms;
}

.intro-screen[data-phase="reveal"] .intro-message {
  opacity: 0;
  transform: scale(0);
}

.intro-signature {
  margin: 14px 0 0;
  text-align: right;
  color: rgba(226, 237, 255, 0.72);
  font-size: 0.74em;
}
```

- [ ] **Step 6: Run shell tests**

Run:

```powershell
node --test tests/intro-controller.test.mjs tests/app-shell.test.mjs
```

Expected result: PASS.

## Task 4: Reading Overlay

**Files:**
- Create: `src/reading-overlay.mjs`
- Modify: `styles.css`

- [ ] **Step 1: Implement Markdown rendering without dependencies**

Create `src/reading-overlay.mjs`:

```js
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderMarkdown(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const html = [];
  let paragraph = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    html.push(`<p>${paragraph.map(escapeHtml).join("<br>")}</p>`);
    paragraph = [];
  }

  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      html.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("# ")) {
      flushParagraph();
      html.push(`<h2>${escapeHtml(line.slice(2))}</h2>`);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return html.join("\n");
}

export function createReadingOverlay({ overlayElement, contentElement, closeButton, onClose }) {
  let activeRecord = null;

  function open(record) {
    activeRecord = record;
    contentElement.innerHTML = `
      <header class="reading-header">
        <p class="reading-date">${escapeHtml(record.date)}</p>
        <h1>${escapeHtml(record.title)}</h1>
        ${record.summary ? `<p class="reading-summary">${escapeHtml(record.summary)}</p>` : ""}
      </header>
      <div class="reading-body">${renderMarkdown(record.body)}</div>
    `;
    overlayElement.classList.add("is-open");
    overlayElement.setAttribute("aria-hidden", "false");
    contentElement.focus({ preventScroll: true });
  }

  function close() {
    activeRecord = null;
    overlayElement.classList.remove("is-open");
    overlayElement.setAttribute("aria-hidden", "true");
    onClose?.();
  }

  closeButton.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeRecord) close();
  });

  return { open, close, getActiveRecord: () => activeRecord };
}
```

- [ ] **Step 2: Add reading overlay CSS**

Append to `styles.css`:

```css
.reading-overlay {
  position: fixed;
  inset: 0;
  z-index: 6;
  display: grid;
  place-items: center;
  padding: clamp(18px, 4vw, 48px);
  background:
    radial-gradient(circle at 50% 42%, rgba(12, 42, 62, 0.34), rgba(2, 4, 11, 0.84) 58%),
    rgba(0, 0, 0, 0.42);
  opacity: 0;
  pointer-events: none;
  backdrop-filter: blur(8px);
  transition: opacity 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

.reading-overlay.is-open {
  opacity: 1;
  pointer-events: auto;
}

.reading-content {
  width: min(760px, 100%);
  max-height: min(78svh, 780px);
  overflow: auto;
  padding: clamp(26px, 5vw, 56px);
  color: rgba(244, 250, 255, 0.94);
  background: rgba(2, 4, 11, 0.58);
  border: 1px solid rgba(185, 241, 255, 0.14);
  border-radius: 8px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.46);
}

.reading-header h1 {
  margin: 0;
  font-size: clamp(30px, 5vw, 54px);
  line-height: 1.1;
  font-weight: 500;
}

.reading-date {
  margin: 0 0 12px;
  color: rgba(185, 241, 255, 0.58);
  font-size: 13px;
}

.reading-summary {
  margin: 18px 0 0;
  color: rgba(226, 237, 255, 0.72);
  font-size: 17px;
  line-height: 1.8;
}

.reading-body {
  margin-top: 34px;
  color: rgba(226, 237, 255, 0.82);
  font-size: 16px;
  line-height: 1.9;
}

.reading-body h2,
.reading-body h3 {
  margin: 32px 0 12px;
  color: rgba(244, 250, 255, 0.94);
  font-weight: 500;
}

.reading-body p {
  margin: 0 0 18px;
}

.reading-close {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 7;
  width: 42px;
  height: 42px;
  color: rgba(226, 237, 255, 0.72);
  background: rgba(2, 4, 11, 0.42);
  border: 1px solid rgba(185, 241, 255, 0.16);
  border-radius: 50%;
  cursor: pointer;
}

.reading-close:hover {
  color: rgba(244, 250, 255, 0.96);
  border-color: rgba(185, 241, 255, 0.34);
}
```

- [ ] **Step 3: Add reduced-motion CSS**

Append to `styles.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.001ms !important;
  }
}
```

## Task 5: Canvas Universe Scene

**Files:**
- Create: `src/universe-scene.mjs`
- Modify: `styles.css`

- [ ] **Step 1: Implement the scene shell**

Create `src/universe-scene.mjs`:

```js
import {
  clampPan,
  createBackgroundStars,
  createRecordNodes,
  getParallaxOffset,
  hitTestNode,
} from "./universe-layout.mjs?v=universe-map-1";

const WORLD = { width: 2800, height: 1700 };
const STAR_LAYERS = [
  { name: "far", strength: 0.22, count: 520, seed: 31 },
  { name: "mid", strength: 0.62, count: 420, seed: 47 },
  { name: "near", strength: 1.08, count: 220, seed: 83 },
];

function drawGlow(context, x, y, radius, color, alpha) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color.replace("ALPHA", String(alpha)));
  gradient.addColorStop(0.45, color.replace("ALPHA", String(alpha * 0.22)));
  gradient.addColorStop(1, color.replace("ALPHA", "0"));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

export function createUniverseScene({ canvas, records, onSelect }) {
  const context = canvas.getContext("2d", { alpha: true });
  const media = window.matchMedia("(max-width: 760px)");
  const state = {
    pan: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    dragging: false,
    pointer: { x: -9999, y: -9999 },
    lastPointer: { x: 0, y: 0 },
    hoveredNodeId: null,
    raf: 0,
    lastTime: 0,
    disposed: false,
    paused: false,
  };
  const stars = STAR_LAYERS.map((layer) => ({
    ...layer,
    stars: createBackgroundStars({
      count: media.matches ? Math.floor(layer.count * 0.58) : layer.count,
      seed: layer.seed,
      width: WORLD.width,
      height: WORLD.height,
    }),
  }));
  const nodes = createRecordNodes(records, WORLD);

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, media.matches ? 1.4 : 2);
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function viewport() {
    return {
      width: canvas.clientWidth || window.innerWidth,
      height: canvas.clientHeight || window.innerHeight,
    };
  }

  function worldToScreen(point, strength = 1) {
    const view = viewport();
    const offset = getParallaxOffset(state.pan, strength);
    return {
      x: view.width / 2 + point.x + offset.x,
      y: view.height / 2 + point.y + offset.y,
    };
  }

  function drawBackground(time) {
    const view = viewport();
    context.clearRect(0, 0, view.width, view.height);

    const base = context.createLinearGradient(0, 0, view.width, view.height);
    base.addColorStop(0, "#02040b");
    base.addColorStop(0.42, "#071426");
    base.addColorStop(1, "#02040b");
    context.fillStyle = base;
    context.fillRect(0, 0, view.width, view.height);

    drawGlow(context, view.width * 0.68, view.height * 0.28, view.width * 0.48, "rgba(86, 198, 230, ALPHA)", 0.18);
    drawGlow(context, view.width * 0.26, view.height * 0.74, view.width * 0.36, "rgba(216, 184, 106, ALPHA)", 0.035);

    for (const layer of stars) {
      for (const star of layer.stars) {
        const point = worldToScreen(star, layer.strength);
        if (point.x < -20 || point.y < -20 || point.x > view.width + 20 || point.y > view.height + 20) continue;

        const twinkle = 0.72 + Math.sin(time / 1200 + star.phase) * 0.28;
        context.fillStyle = star.warmth
          ? `rgba(216, 184, 106, ${star.alpha * twinkle})`
          : `rgba(226, 244, 255, ${star.alpha * twinkle})`;
        context.beginPath();
        context.arc(point.x, point.y, star.radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawRiver(time) {
    const view = viewport();
    const offset = getParallaxOffset(state.pan, 0.76);
    const startX = view.width * 0.72 + offset.x;
    const startY = view.height * 0.88 + offset.y;

    context.save();
    context.globalCompositeOperation = "screen";
    context.lineCap = "round";
    context.lineJoin = "round";

    for (let lane = 0; lane < 5; lane += 1) {
      const drift = Math.sin(time / 2600 + lane) * 16;
      context.beginPath();
      context.moveTo(startX - lane * 34, startY + lane * 12);
      context.bezierCurveTo(
        view.width * 0.54 + offset.x * 0.9,
        view.height * (0.62 + lane * 0.015) + offset.y + drift,
        view.width * 0.42 + offset.x * 0.7,
        view.height * (0.38 - lane * 0.02) + offset.y - drift,
        view.width * 0.2 + offset.x * 0.55,
        view.height * 0.18 + offset.y * 0.8,
      );
      context.strokeStyle = lane === 0 ? "rgba(222, 250, 255, 0.36)" : "rgba(126, 222, 255, 0.12)";
      context.lineWidth = lane === 0 ? 7 : 3;
      context.stroke();
    }

    context.restore();
  }

  function drawNodes(time) {
    const screenNodes = [];

    for (const node of nodes) {
      const point = worldToScreen(node, 0.88);
      const distance = Math.hypot(state.pointer.x - point.x, state.pointer.y - point.y);
      const hovered = distance <= node.revealRadius;
      const pulse = 0.8 + Math.sin(time / 900 + node.progress * Math.PI * 2) * 0.2;
      const alpha = hovered ? 0.92 : 0.35 + node.glow * 0.22 * pulse;
      const radius = hovered ? node.radius * 1.25 : node.radius;

      screenNodes.push({ ...node, screenX: point.x, screenY: point.y });

      context.save();
      context.globalCompositeOperation = "screen";
      drawGlow(context, point.x, point.y, node.revealRadius * (hovered ? 1.3 : 0.72), "rgba(130, 223, 255, ALPHA)", hovered ? 0.22 : 0.075);
      context.fillStyle = `rgba(244, 252, 255, ${alpha})`;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    state.screenNodes = screenNodes;
  }

  function render(time = 0) {
    if (state.disposed) return;

    const view = viewport();
    if (!state.dragging && !state.paused) {
      state.pan.x += state.velocity.x;
      state.pan.y += state.velocity.y;
      state.velocity.x *= 0.92;
      state.velocity.y *= 0.92;
      state.pan = clampPan(state.pan, WORLD, view);
    }

    drawBackground(time);
    drawRiver(time);
    drawNodes(time);

    state.raf = requestAnimationFrame(render);
  }

  function onPointerDown(event) {
    canvas.setPointerCapture?.(event.pointerId);
    state.dragging = true;
    state.lastPointer = { x: event.clientX, y: event.clientY };
    state.velocity = { x: 0, y: 0 };
  }

  function onPointerMove(event) {
    state.pointer = { x: event.clientX, y: event.clientY };

    if (!state.dragging) return;

    const delta = {
      x: event.clientX - state.lastPointer.x,
      y: event.clientY - state.lastPointer.y,
    };
    state.pan.x -= delta.x;
    state.pan.y -= delta.y;
    state.pan = clampPan(state.pan, WORLD, viewport());
    state.velocity = { x: -delta.x * 0.52, y: -delta.y * 0.52 };
    state.lastPointer = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event) {
    state.dragging = false;
    canvas.releasePointerCapture?.(event.pointerId);
  }

  function onClick(event) {
    const hit = hitTestNode(state.screenNodes ?? [], { x: event.clientX, y: event.clientY });
    if (hit) onSelect?.(hit);
  }

  function pause() { state.paused = true; }
  function resume() { state.paused = false; }

  window.addEventListener("resize", resize);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("click", onClick);

  resize();
  state.raf = requestAnimationFrame(render);

  return {
    pause,
    resume,
    destroy() {
      state.disposed = true;
      cancelAnimationFrame(state.raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("click", onClick);
    },
  };
}
```

- [ ] **Step 2: Add fallback style**

Append to `styles.css`:

```css
.noscript-fallback {
  position: fixed;
  inset: 0;
  display: grid;
  place-content: center;
  padding: 32px;
  background: #02040b;
  color: #f3f7ff;
  text-align: center;
}
```

## Task 6: App Orchestration

**Files:**
- Modify: `src/app.mjs`

- [ ] **Step 1: Replace app boot flow**

Modify `src/app.mjs`:

```js
const appElement = document.querySelector("#universe-app");
const introElement = document.querySelector("#intro-screen");
const canvas = document.querySelector("#universe-canvas");
const readingOverlay = document.querySelector("#reading-overlay");
const readingContent = document.querySelector("#reading-content");
const readingClose = document.querySelector("#reading-close");

async function boot() {
  try {
    window.__universeBoot = { step: "loading-modules" };
    const [
      { loadRecords },
      { createIntroController },
      { createReadingOverlay },
      { createUniverseScene },
    ] = await Promise.all([
      import("./record-content.mjs?v=universe-map-1"),
      import("./intro-controller.mjs?v=universe-map-1"),
      import("./reading-overlay.mjs?v=universe-map-1"),
      import("./universe-scene.mjs?v=universe-map-1"),
    ]);

    window.__universeBoot = { step: "loading-records" };
    const records = await loadRecords();

    let universeScene = null;
    const reader = createReadingOverlay({
      overlayElement: readingOverlay,
      contentElement: readingContent,
      closeButton: readingClose,
      onClose: () => universeScene?.resume(),
    });

    window.__universeBoot = { step: "creating-scene", records: records.length };
    universeScene = createUniverseScene({
      canvas,
      records,
      onSelect: (record) => {
        universeScene?.pause();
        reader.open(record);
      },
    });

    createIntroController({
      introElement,
      appElement,
      onDone: () => {
        window.__universeBoot = { step: "ready", records: records.length };
      },
    });
  } catch (error) {
    window.__universeBoot = {
      step: "error",
      message: error?.message ?? String(error),
      stack: error?.stack ?? "",
    };
    console.error(error);
  }
}

boot();
```

- [ ] **Step 2: Run all unit tests**

Run:

```powershell
node --test tests/record-content.test.mjs tests/universe-layout.test.mjs tests/intro-controller.test.mjs tests/app-shell.test.mjs
```

Expected result: PASS.

## Task 7: Manual Browser Verification

**Files:**
- No code changes unless verification exposes a defect.

- [ ] **Step 1: Start a local static server**

Run:

```powershell
python -m http.server 8791
```

Expected result: server listens on `http://localhost:8791`. If port `8791` is already occupied, use `python -m http.server 8792`.

- [ ] **Step 2: Verify desktop first load**

Open:

```text
http://localhost:8791
```

Desktop viewport target: `1440 x 900`.

Expected result:

- Black intro appears.
- Text reads exactly `这里是，我的世界` with signature `——Robin`.
- Intro collapses and reveals a starfield.
- Exploration state has no text, labels, years, nav, or visible buttons.
- `window.__universeBoot.step === "ready"` in browser console.

- [ ] **Step 3: Verify desktop dragging and discovery**

In the browser:

1. Drag horizontally and vertically across the starfield.
2. Stop dragging and observe inertia.
3. Move pointer near brighter record nodes.
4. Click a visible node.

Expected result:

- Different star layers move at different speeds.
- Dragging has damped inertia.
- No reachable area is empty black.
- Node glow strengthens near pointer.
- Click opens reading overlay.

- [ ] **Step 4: Verify reading mode**

In reading mode:

1. Confirm starfield is still visible behind a dark reading layer.
2. Confirm title, date, summary, and Markdown body render.
3. Press `Esc`.
4. Reopen a node and click close.

Expected result:

- Reading content is legible.
- `Esc` closes the overlay.
- Close button closes the overlay.
- Exploration returns to pure starfield.

- [ ] **Step 5: Verify mobile behavior**

Use viewport target `390 x 844`.

Expected result:

- Intro still fits.
- Exploration remains starfield, not a list.
- Touch drag moves the universe.
- Reading overlay fits within screen and scrolls internally.

## Task 8: Full Verification

**Files:**
- No code changes unless verification exposes a defect.

- [ ] **Step 1: Run new test suite**

Run:

```powershell
node --test tests/record-content.test.mjs tests/universe-layout.test.mjs tests/intro-controller.test.mjs tests/app-shell.test.mjs
```

Expected result: PASS.

- [ ] **Step 2: Run existing tests to catch regressions**

Run:

```powershell
node --test tests/star-content.test.mjs tests/star-layout.test.mjs tests/star-field-controls.test.mjs
```

Expected result: PASS. If these tests fail only because the old star-road runtime is no longer imported by the app, keep the source modules intact and update the test scope in a separate review step before deleting any old files.

- [ ] **Step 3: Inspect git diff**

Run:

```powershell
git status --short
git diff -- index.html styles.css src/app.mjs src/record-content.mjs src/universe-layout.mjs src/intro-controller.mjs src/reading-overlay.mjs src/universe-scene.mjs
```

Expected result:

- Only planned files are changed.
- No unrelated files are modified.
- No generated screenshots are required for this first pass unless Robin asks for screenshot artifacts.

## Self-Review Notes

- Spec coverage: intro, pure exploration, 2.5D parallax dragging, no exploration text, sparse clickable nodes, starfield reading mode, flexible Markdown content, static-site architecture, and no Godot/Next/360 route are all covered.
- Scope: first pass implements front-end experience with test records only. Real content migration and high-end asset replacement are separate work.
- Risk control: old star-road modules are not deleted in this plan, reducing rollback risk.
- User rule alignment: no dependency install, no file deletion, no git commit steps.
