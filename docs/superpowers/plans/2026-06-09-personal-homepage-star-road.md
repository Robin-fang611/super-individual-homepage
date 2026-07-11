# Personal Homepage Star Road Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, Cloudflare Pages-ready personal homepage prototype with a draggable 2.5D star road, Markdown frontmatter star nodes, hover states, and a right-side detail panel.

**Architecture:** The site is buildless static HTML/CSS/ES modules. Markdown star files live under `content/stars/`; `src/star-content.mjs` parses frontmatter, `src/star-layout.mjs` computes star positions, `src/star-field.mjs` renders and handles interaction, and `src/app.mjs` wires UI state. Tests use Node's built-in `node --test` runner, so no dependency install is required.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Canvas 2D, Markdown frontmatter, Node built-in test runner, Cloudflare Pages static hosting.

---

## Files

- Create: `index.html` - static entry page.
- Create: `styles.css` - full visual system, responsive layout, panel, navigation, reduced-motion support.
- Create: `src/star-content.mjs` - fetch and parse Markdown frontmatter star nodes.
- Create: `src/star-layout.mjs` - sort stars and compute curved 2.5D positions.
- Create: `src/star-field.mjs` - Canvas renderer, drag/scroll controls, hit testing, camera focus.
- Create: `src/app.mjs` - app boot, content loading, panel rendering, nav interactions.
- Create: `content/stars/index.json` - manifest of Markdown node files.
- Create: `content/stars/2026-06-09-current.md` - current star seed node.
- Create: `content/stars/2025-01-01-path.md` - historical seed node.
- Create: `content/stars/2024-01-01-origin.md` - historical seed node.
- Create: `tests/star-content.test.mjs` - parser tests.
- Create: `tests/star-layout.test.mjs` - layout tests.
- Create: `scripts/validate-content.mjs` - content validation command.
- Create: `README.md` - local preview and Cloudflare Pages deployment instructions.
- Create: `_headers` - static security headers for Cloudflare Pages.
- Modify: `docs/personal-homepage-design.md` only if implementation discoveries require a design note.

No git commits in this run unless Robin explicitly asks.

## Task 1: Content Parser

**Files:**
- Create: `src/star-content.mjs`
- Create: `tests/star-content.test.mjs`

- [ ] **Step 1: Write failing parser tests**

Create `tests/star-content.test.mjs` with tests for frontmatter parsing, public filtering, current star detection, and invalid required fields.

Run: `node --test tests/star-content.test.mjs`

Expected before implementation: FAIL with module not found for `src/star-content.mjs`.

- [ ] **Step 2: Implement parser**

Create `src/star-content.mjs` exporting:

```js
export function parseStarMarkdown(markdown, file = "inline.md") {}
export function parseFrontmatterValue(value) {}
export function validateStar(star) {}
export function sortStarsByDate(stars) {}
export async function loadStars(manifestUrl = "/content/stars/index.json") {}
```

Parser rules:
- Required fields: `title`, `date`, `year`, `type`, `summary`, `visibility`.
- Optional field: `current`, boolean.
- Only `visibility: "public"` nodes render.
- Dates sort newest first.

- [ ] **Step 3: Verify parser tests pass**

Run: `node --test tests/star-content.test.mjs`

Expected: PASS.

## Task 2: Star Layout

**Files:**
- Create: `src/star-layout.mjs`
- Create: `tests/star-layout.test.mjs`

- [ ] **Step 1: Write failing layout tests**

Create tests asserting:
- Current star is nearest.
- Older stars have greater depth.
- Stars follow a gentle curve.
- Camera constraints clamp movement near the path.

Run: `node --test tests/star-layout.test.mjs`

Expected before implementation: FAIL with module not found for `src/star-layout.mjs`.

- [ ] **Step 2: Implement layout utilities**

Create `src/star-layout.mjs` exporting:

```js
export function createStarLayout(stars) {}
export function clampCamera(camera, bounds) {}
export function projectStar(star, camera, viewport) {}
export function findNearestStar(stars, point, camera, viewport) {}
```

Layout rules:
- Gentle curve, not spiral.
- Current star is visually near the front.
- Other stars recede with smaller size and lower opacity.
- Camera remains within computed path bounds.

- [ ] **Step 3: Verify layout tests pass**

Run: `node --test tests/star-layout.test.mjs`

Expected: PASS.

## Task 3: Static Content

**Files:**
- Create: `content/stars/index.json`
- Create: `content/stars/2026-06-09-current.md`
- Create: `content/stars/2025-01-01-path.md`
- Create: `content/stars/2024-01-01-origin.md`
- Create: `scripts/validate-content.mjs`

- [ ] **Step 1: Write content validation script**

Create `scripts/validate-content.mjs` importing parser functions and reading the manifest plus Markdown files from disk.

Run: `node scripts/validate-content.mjs`

Expected before content files exist: FAIL with missing manifest.

- [ ] **Step 2: Add seed Markdown nodes**

Add three public nodes:
- Current star for 2026-06-09.
- One 2025 path node.
- One 2024 origin node.

- [ ] **Step 3: Verify content validates**

Run: `node scripts/validate-content.mjs`

Expected: `Validated 3 public star nodes.`

## Task 4: Page Shell And Styling

**Files:**
- Create: `index.html`
- Create: `styles.css`

- [ ] **Step 1: Create shell**

Create a full-viewport page with:
- Canvas layer.
- Hero title `Robin`.
- Subtitle `星辰，进化之路`.
- Hidden compass button.
- Right detail panel.
- Mobile bottom sheet container.
- Noscript fallback.

- [ ] **Step 2: Create visual system**

Create styles for:
- Deep blue-black background.
- Silver stars and ice-blue accent.
- Xingkai title fallback stack for title area.
- Modern sans-serif body.
- Hidden navigation affordance.
- Glass panel.
- Reduced motion.
- Responsive mobile layout.

- [ ] **Step 3: Static smoke check**

Run: `node scripts/validate-content.mjs`

Expected: validation still passes.

## Task 5: Canvas Star Field

**Files:**
- Create: `src/star-field.mjs`
- Create: `src/app.mjs`
- Modify: `index.html`

- [ ] **Step 1: Implement app boot**

`src/app.mjs` loads stars, creates layout, initializes the star field, and updates panel state.

- [ ] **Step 2: Implement Canvas renderer**

`src/star-field.mjs` renders:
- Star dust and medium nebula.
- Gentle curved star path.
- Current star and other stars.
- Hover glow and scale.
- Drag primary, wheel secondary navigation.
- Camera locked near path.
- Click focus then panel open.

- [ ] **Step 3: Wire modules**

Import `src/app.mjs` from `index.html`.

- [ ] **Step 4: Run tests**

Run: `node --test tests/star-content.test.mjs tests/star-layout.test.mjs`

Expected: PASS.

## Task 6: Local Preview And Deploy Readiness

**Files:**
- Create: `README.md`
- Create: `_headers`

- [ ] **Step 1: Add deployment docs**

README includes:
- Local preview command: `python -m http.server 8788`
- Open: `http://localhost:8788`
- Test command: `node --test tests/star-content.test.mjs tests/star-layout.test.mjs`
- Content validation command: `node scripts/validate-content.mjs`
- Cloudflare Pages settings: framework preset `None`, build command blank, output directory `/`.

- [ ] **Step 2: Add security headers**

Create `_headers` with conservative static headers.

- [ ] **Step 3: Verify deployable static project**

Run:
- `node --test tests/star-content.test.mjs tests/star-layout.test.mjs`
- `node scripts/validate-content.mjs`

Expected:
- Tests PASS.
- Content validation prints `Validated 3 public star nodes.`

Optional manual preview:
- Start local server with `python -m http.server 8788`.
- Open `http://localhost:8788`.
- Confirm canvas renders, drag moves the star road, click opens panel, mobile width shows bottom sheet.

## Self-Review

- Spec coverage: covers static Cloudflare Pages, Markdown frontmatter, current/other stars, hover glow+scale, hidden title transition, draggable medium 2.5D desktop, simple mobile vertical behavior, and first-version scope limits.
- Placeholder scan: no TBD/TODO placeholders are intentionally left in the implementation plan.
- Type consistency: parser functions, layout functions, and app import responsibilities are named consistently across tasks.
