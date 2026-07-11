# Adaptive Quality and Five-Second Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不依赖 GPU 型号猜测的前提下，五秒内开放飞行，并用帧时间闭环自动维持稳定体验。

**Architecture:** 四份不可变质量配置定义成本上限；`FrameMonitor` 采集有效帧，`QualityController` 执行快速降档、缓慢升档和防抖，`AssetTierLoader` 只加载已通过档位需要的增量资源。静态首屏与 WebGL 回退始终独立存在。

**Tech Stack:** 原生 ES Modules、Three.js、Performance API、Node.js `node:test`、HTML/CSS、浏览器缓存与静态 CDN。

## Global Constraints

- 不新增第三方依赖，不用 GPU renderer 字符串做选档。
- 冷缓存、4 Mbps、约 80 ms RTT 时五秒内可控制。
- 首五秒关键传输目标不超过 1.2 MiB，硬上限 1.5 MiB。
- 高档资源未到或失败时继续使用低成本替身，不阻塞飞行。
- 所有档位保持同一世界坐标、构图、交互和色彩语义。
- 快速降档、缓慢升档、只试探相邻档。

---

### Task 1: 质量配置与能力约束

**Files:**
- Create: `src/universe/quality-profiles.mjs`
- Create: `src/universe/capability-guard.mjs`
- Create: `tests/universe-quality-profiles.test.mjs`

**Interfaces:**
- Produces: `QUALITY_ORDER: readonly string[]`
- Produces: `QUALITY_PROFILES: Readonly<Record<QualityName, QualityProfile>>`
- Produces: `constrainProfile(profile, capabilities): QualityProfile`

- [ ] **Step 1: 写失败测试，锁定四档和不可变性**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { QUALITY_ORDER, QUALITY_PROFILES } from "../src/universe/quality-profiles.mjs";

test("defines four immutable adjacent quality tiers", () => {
  assert.deepEqual(QUALITY_ORDER, ["performance", "balanced", "high", "cinematic"]);
  for (const name of QUALITY_ORDER) assert.ok(Object.isFrozen(QUALITY_PROFILES[name]));
  assert.ok(QUALITY_PROFILES.performance.dprMax < QUALITY_PROFILES.cinematic.dprMax);
  assert.equal(QUALITY_PROFILES.performance.worldSeed, QUALITY_PROFILES.cinematic.worldSeed);
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/universe-quality-profiles.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 实现不可变配置**

```js
const profile = (value) => Object.freeze(value);
export const QUALITY_ORDER = Object.freeze(["performance", "balanced", "high", "cinematic"]);
export const QUALITY_PROFILES = Object.freeze({
  performance: profile({ name: "performance", worldSeed: 611, dprMax: 1, renderScale: [0.7,1], inkMode: "slices", inkSteps: 0, accentRatio: 0.2, bloomScale: 0, viewDistance: 0.55, gpuBudgetMiB: 96, assetTier: "core" }),
  balanced: profile({ name: "balanced", worldSeed: 611, dprMax: 1.25, renderScale: [0.8,1], inkMode: "hybrid", inkSteps: 18, accentRatio: 0.45, bloomScale: 0.25, viewDistance: 0.75, gpuBudgetMiB: 160, assetTier: "balanced" }),
  high: profile({ name: "high", worldSeed: 611, dprMax: 1.5, renderScale: [0.85,1], inkMode: "volume", inkSteps: 32, accentRatio: 0.75, bloomScale: 0.5, viewDistance: 1, gpuBudgetMiB: 256, assetTier: "high" }),
  cinematic: profile({ name: "cinematic", worldSeed: 611, dprMax: 2, renderScale: [0.9,1], inkMode: "volume", inkSteps: 52, accentRatio: 1, bloomScale: 0.75, viewDistance: 1.2, gpuBudgetMiB: 384, assetTier: "cinematic" }),
});
```

`constrainProfile` 只根据 WebGL2、浮点纹理、最大纹理尺寸和可用扩展关闭不支持的字段；不得修改 `worldSeed`、地标或色彩。

```js
export function constrainProfile(profile,capabilities){ const constrained={...profile}; if(!capabilities.webgl2||!capabilities.floatTextures){ constrained.inkMode="slices"; constrained.inkSteps=0; } if(capabilities.maxTextureSize<4096){ constrained.dprMax=Math.min(constrained.dprMax,1.25); } return Object.freeze(constrained); }
```

- [ ] **Step 4: 运行测试**

Run: `node --test tests/universe-quality-profiles.test.mjs`  
Expected: PASS, including capability fallback cases.

- [ ] **Step 5: 提交**

```bash
git add src/universe/quality-profiles.mjs src/universe/capability-guard.mjs tests/universe-quality-profiles.test.mjs
git commit -m "feat: define adaptive quality profiles"
```

### Task 2: 帧时间监测

**Files:**
- Create: `src/universe/frame-monitor.mjs`
- Create: `tests/universe-frame-monitor.test.mjs`

**Interfaces:**
- Produces: `createFrameMonitor({ windowSize }): { push, pause, resume, reset, summary }`
- `summary(): { count, p50, p95, longFrameCount, dropRate, consecutiveOver33 }`

- [ ] **Step 1: 写失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createFrameMonitor } from "../src/universe/frame-monitor.mjs";

test("reports percentiles and ignores paused samples", () => {
  const monitor = createFrameMonitor({ windowSize: 5 });
  [16,17,18,40,50].forEach((ms) => monitor.push(ms));
  monitor.pause(); monitor.push(1000); monitor.resume();
  const result = monitor.summary();
  assert.equal(result.count, 5);
  assert.equal(result.p50, 18);
  assert.equal(result.p95, 50);
  assert.equal(result.longFrameCount, 2);
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/universe-frame-monitor.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 实现滚动窗口与统计**

```js
const percentile = (values, ratio) => values[Math.min(values.length-1, Math.floor((values.length-1)*ratio))] ?? 0;
export function createFrameMonitor({ windowSize = 120 } = {}) {
  let paused = false, samples = [];
  return {
    push(ms) { if (!paused && Number.isFinite(ms) && ms > 0 && ms < 250) { samples.push(ms); if (samples.length > windowSize) samples.shift(); } },
    pause() { paused = true; }, resume() { paused = false; }, reset() { samples = []; },
    summary() { const sorted = [...samples].sort((a,b) => a-b); let streak = 0, maxStreak = 0; for (const ms of samples) { streak = ms > 33 ? streak+1 : 0; maxStreak = Math.max(maxStreak, streak); } const longFrameCount = samples.filter((ms) => ms > 33).length; return { count: samples.length, p50: percentile(sorted,0.5), p95: percentile(sorted,0.95), longFrameCount, dropRate: samples.length ? longFrameCount/samples.length : 0, consecutiveOver33: maxStreak }; },
  };
}
```

- [ ] **Step 4: 运行测试**

Run: `node --test tests/universe-frame-monitor.test.mjs`  
Expected: PASS.

- [ ] **Step 5: 提交**

```bash
git add src/universe/frame-monitor.mjs tests/universe-frame-monitor.test.mjs
git commit -m "feat: monitor browser frame stability"
```

### Task 3: 自动升降档控制器

**Files:**
- Create: `src/universe/quality-controller.mjs`
- Create: `src/universe/quality-preference.mjs`
- Create: `tests/universe-quality-controller.test.mjs`

**Interfaces:**
- Consumes: `QUALITY_ORDER`, `QUALITY_PROFILES`, `FrameSummary`.
- Produces: `createQualityController({ now, initial, mode, saved }): QualityController`
- Produces: `loadQualityPreference(storage): { mode, tier } | null`
- Produces: `saveQualityPreference(storage, preference): void`
- QualityController: `{ evaluate, setManual, setAuto, setSafetyOverride, clearSafetyOverride, snapshot }`

- [ ] **Step 1: 写失败测试，锁定紧急降档和慢速升档**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createQualityController } from "../src/universe/quality-controller.mjs";

test("drops immediately on severe frames and does not bounce back", () => {
  let time = 0;
  const controller = createQualityController({ now: () => time, initial: "high", mode: "auto" });
  controller.evaluate({ count:120,p50:20,p95:45,dropRate:0.2,consecutiveOver33:5 });
  assert.equal(controller.snapshot().tier, "balanced");
  time += 5000;
  controller.evaluate({ count:120,p50:16.7,p95:17,dropRate:0,consecutiveOver33:0 });
  assert.equal(controller.snapshot().tier, "balanced");
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/universe-quality-controller.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 实现相邻档、防抖和档内 render scale**

```js
import { QUALITY_ORDER, QUALITY_PROFILES } from "./quality-profiles.mjs";
export function createQualityController({ now = () => performance.now(), initial = "balanced", mode = "auto" } = {}) {
  let tier = initial, currentMode = mode, renderScale = 1, lastChange = -Infinity, upgradeWindows = 0, downgradeWindows = 0, safetyOverride = null;
  const adjacent = (direction) => QUALITY_ORDER[Math.min(QUALITY_ORDER.length-1, Math.max(0, QUALITY_ORDER.indexOf(tier)+direction))];
  const change = (next, reason) => { if (next !== tier) { tier = next; renderScale = 1; lastChange = now(); upgradeWindows = 0; downgradeWindows = 0; } return reason; };
  return {
    evaluate(summary) {
      if (currentMode !== "auto" || summary.count < 45) return null;
      if (summary.consecutiveOver33 >= 5 || summary.p95 > 40) return change(adjacent(-1), "emergency-frame-time");
      const weak = summary.p95 > 25 || summary.dropRate > 0.1 || summary.p50 > 18.5;
      downgradeWindows = weak ? downgradeWindows+1 : 0;
      if (downgradeWindows >= 2) { const min = QUALITY_PROFILES[tier].renderScale[0]; if (renderScale > min) { renderScale = Math.max(min, renderScale-0.05); downgradeWindows = 0; return "reduce-render-scale"; } if (now()-lastChange >= 8000) return change(adjacent(-1), "sustained-frame-time"); }
      const strong = summary.p95 <= 18.5 && summary.dropRate < 0.02 && summary.consecutiveOver33 === 0;
      upgradeWindows = strong ? upgradeWindows+1 : 0;
      if (upgradeWindows >= 3 && now()-lastChange >= 20000) return change(adjacent(1), "stable-upgrade-probe");
      return null;
    },
    setManual(name) { currentMode = "manual"; change(name, "manual"); }, setAuto() { currentMode = "auto"; }, setSafetyOverride(name){safetyOverride=name;},clearSafetyOverride(){safetyOverride=null;},
    snapshot() { const effectiveTier=safetyOverride??tier; return { tier, effectiveTier, mode: currentMode, renderScale, profile: QUALITY_PROFILES[effectiveTier] }; },
  };
}
```

```js
const KEY="robin-universe-quality-v1";
export function loadQualityPreference(storage=localStorage){ try{ const value=JSON.parse(storage.getItem(KEY)); return value&&["auto","manual"].includes(value.mode)?value:null; }catch{return null;} }
export function saveQualityPreference(storage=localStorage,preference){ storage.setItem(KEY,JSON.stringify({mode:preference.mode,tier:preference.tier})); }
```

为手动 Cinematic 增加硬安全阀：连续 10 帧超过 50 ms 时只降低 `renderScale`，不改变保存的手动档位。

- [ ] **Step 4: 运行测试**

Run: `node --test tests/universe-quality-controller.test.mjs`  
Expected: PASS for emergency downgrade, adjacent-only changes, 30-second upgrade lockout, manual persistence and safety scale.

- [ ] **Step 5: 提交**

```bash
git add src/universe/quality-controller.mjs src/universe/quality-preference.mjs tests/universe-quality-controller.test.mjs
git commit -m "feat: adapt quality from observed frame time"
```

### Task 4: 增量资源加载器

**Files:**
- Create: `src/universe/asset-tier-loader.mjs`
- Create: `assets/ink-universe/manifest.json`
- Create: `tests/universe-asset-loader.test.mjs`

**Interfaces:**
- Produces: `createAssetTierLoader({ fetchImpl, decode, onReady, onError }): AssetTierLoader`
- AssetTierLoader: `{ ensureTier(name), cancelAbove(name), snapshot(), destroy() }`

- [ ] **Step 1: 写失败测试，确认失败不会阻塞当前替身**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createAssetTierLoader } from "../src/universe/asset-tier-loader.mjs";

test("keeps core ready when a high asset fails", async () => {
  const errors = [];
  const loader = createAssetTierLoader({ manifest:{core:["/core.bin"],balanced:[],high:["/high.bin"],cinematic:[]},fetchImpl: async (url) => { if (url.includes("high")) throw new Error("offline"); return { ok:true,arrayBuffer:async()=>new ArrayBuffer(1) }; }, decode: async (response) => response.arrayBuffer(), onError: (error) => errors.push(error.message) });
  await loader.ensureTier("core");
  await loader.ensureTier("high");
  assert.equal(loader.snapshot().ready.has("core"), true);
  assert.deepEqual(errors, ["offline"]);
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/universe-asset-loader.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 实现按清单加载、取消和错误回退**

`manifest.json` 使用稳定结构：

```json
{
  "core": [],
  "balanced": [],
  "high": [],
  "cinematic": []
}
```

```js
const order = ["core","balanced","high","cinematic"];
export function createAssetTierLoader({ fetchImpl=fetch, decode=async (response)=>response.arrayBuffer(), manifest={ core:[],balanced:[],high:[],cinematic:[] }, onReady, onError }) {
  const ready = new Set(), controllers = new Map();
  async function ensureTier(name) { for (const tier of order.slice(0,order.indexOf(name)+1)) { if (ready.has(tier)) continue; const controller = new AbortController(); controllers.set(tier,controller); try { const assets = await Promise.all(manifest[tier].map(async (url) => { const response = await fetchImpl(url,{ signal:controller.signal }); if (!response.ok) throw new Error(`Asset ${url} failed: ${response.status}`); return decode(response,url); })); ready.add(tier); onReady?.(tier,assets); } catch (error) { if (error.name !== "AbortError") onError?.(error,tier); return false; } finally { controllers.delete(tier); } } return true; }
  return { ensureTier, cancelAbove(name) { for (const tier of order.slice(order.indexOf(name)+1)) controllers.get(tier)?.abort(); }, snapshot() { return { ready:new Set(ready), loading:new Set(controllers.keys()) }; }, destroy() { for (const controller of controllers.values()) controller.abort(); controllers.clear(); } };
}
```

- [ ] **Step 4: 运行测试**

Run: `node --test tests/universe-asset-loader.test.mjs`  
Expected: PASS for ordered loading, cancellation, failure fallback and duplicate suppression.

- [ ] **Step 5: 提交**

```bash
git add src/universe/asset-tier-loader.mjs assets/ink-universe/manifest.json tests/universe-asset-loader.test.mjs
git commit -m "feat: load universe assets by quality tier"
```

### Task 5: 启动时序、静态回退和运行时接入

**Files:**
- Create: `src/universe/loading-timeline.mjs`
- Modify: `src/universe/runtime.mjs`
- Modify: `src/star-field.mjs`
- Modify: `src/app.mjs`
- Modify: `index.html`
- Modify: `styles.css`
- Create: `tests/universe-loading-timeline.test.mjs`

**Interfaces:**
- Produces: `markMilestone(name, now): void`
- Produces: `getLoadingSnapshot(): Record<string, number>`
- Runtime consumes `QualityController`, `FrameMonitor`, `AssetTierLoader`.

- [ ] **Step 1: 写加载里程碑失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createLoadingTimeline } from "../src/universe/loading-timeline.mjs";

test("records each milestone once", () => {
  const timeline = createLoadingTimeline(() => 1000);
  timeline.mark("shellPaint"); timeline.mark("shellPaint"); timeline.mark("interactive", 4900);
  assert.deepEqual(timeline.snapshot(), { shellPaint:1000, interactive:4900 });
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/universe-loading-timeline.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 实现里程碑和静态首屏**

```js
export function createLoadingTimeline(now = () => performance.now()) { const values = {}; return { mark(name,value=now()) { if (!(name in values)) values[name]=value; }, snapshot() { return { ...values }; } }; }
```

在 `index.html` 的 canvas 前保留一个青黑静态 fallback 元素；`styles.css` 让它在 `data-renderer-ready="true"` 后 200 ms 淡出。WebGL 初始化失败或 context lost 且恢复失败时重新显示。

```html
<div class="renderer-fallback" id="renderer-fallback" aria-hidden="true"></div>
<canvas id="universe-canvas" class="universe-canvas" aria-hidden="true"></canvas>
```

```css
.renderer-fallback{position:fixed;inset:0;background:radial-gradient(circle at 70% 30%,#0a2235 0,#03101b 38%,#01040a 72%);opacity:1;transition:opacity .2s linear;pointer-events:none}
.universe-app[data-renderer-ready="true"] .renderer-fallback{opacity:0}
```

- [ ] **Step 4: 将质量闭环接入唯一 RAF**

每个有效渲染帧把帧间隔推入 monitor；每秒调用 controller；档位或 render scale 变化时调用 `renderer.setPixelRatio(Math.min(devicePixelRatio, profile.dprMax)*renderScale)`、`SceneWorld.applyQuality(profile)` 和 `loader.ensureTier(profile.assetTier)`。shader 编译、纹理上传、页面隐藏和 resize 校准期间暂停评分。

为 canvas 注册确定性恢复路径：

```js
canvas.addEventListener("webglcontextlost",(event)=>{event.preventDefault();runtime.pause();appElement.dataset.rendererReady="false";});
canvas.addEventListener("webglcontextrestored",async()=>{qualityController.setSafetyOverride("performance");await loader.ensureTier("core");runtime.resume();appElement.dataset.rendererReady="true";setTimeout(()=>qualityController.clearSafetyOverride(),30000);});
```

- [ ] **Step 5: 运行全部测试和内容验证**

Run: `node --test tests/*.test.mjs`  
Expected: PASS.  
Run: `node scripts/validate-content.mjs`  
Expected: `Validated 3 public star nodes.`

- [ ] **Step 6: 提交**

```bash
git add src/universe/loading-timeline.mjs src/universe/runtime.mjs src/star-field.mjs src/app.mjs index.html styles.css tests/universe-loading-timeline.test.mjs
git commit -m "feat: integrate adaptive loading and quality"
```

### Task 6: 性能预算与慢网验收

**Files:**
- Create: `scripts/check-critical-budget.mjs`
- Create: `tests/critical-budget.test.mjs`
- Create: `docs/qa/performance-matrix.md`
- Create: `_headers`
- Modify: `README.md`

**Interfaces:**
- Produces: `measureCriticalAssets(root): { files, bytes }`

- [ ] **Step 1: 写资源预算失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { measureCriticalAssets } from "../scripts/check-critical-budget.mjs";

test("critical startup assets stay below the hard byte budget", async () => {
  const result = await measureCriticalAssets(new URL("..", import.meta.url));
  assert.ok(result.bytes <= 1.5*1024*1024, `critical bytes: ${result.bytes}`);
  assert.ok(result.files.length <= 20);
});
```

- [ ] **Step 2: 运行测试，记录当前基线而不是修改阈值逃避失败**

Run: `node --test tests/critical-budget.test.mjs`  
Expected: PASS if core manifest is within budget; otherwise FAIL with measured bytes and optimize only critical resources.

在 `scripts/check-critical-budget.mjs` 中导出并调用以下实现：

```js
import { readFile,stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const critical=["index.html","styles.css","src/app.mjs","assets/three.module.js","assets/ink-universe/manifest.json"];
export async function measureCriticalAssets(root){ const base=fileURLToPath(root); const files=[]; let bytes=0; for(const path of critical){ try{ const info=await stat(`${base}/${path}`); files.push(path); bytes+=info.size; }catch(error){ if(error.code!=="ENOENT") throw error; } } return {files,bytes}; }
if(process.argv[1]===fileURLToPath(import.meta.url)){ const result=await measureCriticalAssets(new URL("..",import.meta.url)); console.log(`Critical assets: ${result.bytes} bytes across ${result.files.length} files`); if(result.bytes>1572864||result.files.length>20) process.exitCode=1; }
```

- [ ] **Step 3: 创建性能矩阵并实测**

```markdown
| 设备 | 浏览器 | 网络 | shellPaint | firstCanvasFrame | interactive | 稳定档 | p95 | 变档次数 | 结果 |
|---|---|---|---:|---:|---:|---|---:|---:|---|
```

使用 DevTools 网络节流模拟 4 Mbps/80 ms，分别冷缓存和热缓存测试。必须记录失败，不允许只填写通过设备。

`_headers` 明确 HTML 重新验证、带内容哈希的静态资源长期缓存；不得添加 Service Worker：

```text
/*.html
  Cache-Control: public, max-age=0, must-revalidate
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

- [ ] **Step 4: 跑最终回归**

Run: `node --test tests/*.test.mjs`  
Expected: PASS.  
Run: `node scripts/check-critical-budget.mjs`  
Expected: prints total critical bytes `<= 1572864` and request count `<= 20`.

- [ ] **Step 5: 提交**

```bash
git add scripts/check-critical-budget.mjs tests/critical-budget.test.mjs docs/qa/performance-matrix.md README.md _headers
git commit -m "test: enforce universe startup budgets"
```
