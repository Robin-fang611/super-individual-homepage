# 原场景嵌入式内容节点 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变现有水墨宇宙世界的情况下，为公开记录增加常显、克制的空间节点，并通过连续镜头推进进入现有阅读层。

**Architecture:** 节点使用独立 DOM 交互层，通过 Three.js 相机把固定世界坐标投影到屏幕；水墨世界模块保持原样。`UniverseRuntime` 继续作为 PlayerRig 唯一写入者，统一处理自由飞行、节点聚焦、阅读锁定和返回。现有 Markdown 记录与阅读层继续承担内容，不让视觉节点依赖具体文案结构。

**Tech Stack:** 原生 ES Modules、Three.js 本地模块、HTML/CSS、Node.js 内置 test runner、Cloudflare Pages 静态部署。

## Global Constraints

- 设计规格：`docs/superpowers/specs/2026-07-16-embedded-content-nodes-design.md`。
- 回滚基准：`baseline/online-2026-07-15-ink-universe`，线上代码提交 `186f5eab1c370e489353923dd564f8fe1ec704b8`。
- 不修改 `src/universe/ink-world.mjs`、`src/universe/ink-panorama.mjs`、`src/universe/ink-color-grade.mjs`、`src/universe/quality-profiles.mjs` 或任何 `assets/images/ink-universe-panorama-*` 文件。
- 不新增或升级第三方依赖。
- 不增加轨道、路线、星座、浮岛、建筑、HUD 面板或装饰性背景。
- 默认标签视觉字号 `11–12px`、透明度 `0.34–0.40`；hover/focus 视觉字号 `15–16px`、透明度 `0.92–1`。
- 点击进入时长 `1.2–1.6s`，停止距离 `1.35` 世界单位；阅读状态世界动画速率 `0.18`。
- `prefers-reduced-motion: reduce` 下不执行长距离镜头推进。
- 继续保持纯静态部署。

---

## 文件结构

### 新建

- `src/universe/spatial-node-layout.mjs`：固定槽位和记录映射。
- `src/universe/spatial-node-layer.mjs`：DOM 节点、相机投影、可见性和交互状态。
- `src/universe/focus-transition.mjs`：镜头位姿插值纯函数。
- `tests/universe-spatial-node-layout.test.mjs`：槽位映射测试。
- `tests/universe-spatial-node-layer.test.mjs`：节点层与清理测试。
- `tests/universe-focus-transition.test.mjs`：过渡插值测试。
- `tests/reading-overlay.test.mjs`：阅读层进入/退出时序与焦点测试。

### 修改

- `index.html`：加入 `#universe-nodes` 容器。
- `styles.css`：节点外观、交互状态、阅读层连续过渡、reduced-motion。
- `src/app.mjs`：records → spatial nodes → scene → reader 的组装。
- `src/star-field.mjs`：节点层、投影刷新、聚焦 API、低速世界时钟。
- `src/reading-overlay.mjs`：异步关闭完成通知和焦点恢复。
- `src/universe/experience-state.mjs`：`focusing`、`content`、`returning` 状态。
- `src/universe/runtime.mjs`：PlayerRig 聚焦和精确返回。
- `tests/app-shell.test.mjs`：从“禁止任何标签”改为“只允许空间内容节点”。
- `tests/star-field-controls.test.mjs`：节点集成和世界不变约束。
- `tests/universe-experience-state.test.mjs`：新状态流。
- `tests/universe-runtime.test.mjs`：聚焦、锁定、返回和 reduced-motion。
- `tests/universe-runtime-contract.test.mjs`：PlayerRig 单一写入者契约。

---

### Task 1: 建立稳定的空间节点数据模型

**Files:**
- Create: `src/universe/spatial-node-layout.mjs`
- Create: `tests/universe-spatial-node-layout.test.mjs`

**Interfaces:**
- Consumes: `records: Array<{ id: string, title: string, visibility: string }>`。
- Produces: `SPATIAL_NODE_SLOTS` 与 `mapRecordsToSpatialNodes(records, slots?)`。
- Node shape: `{ id: string, recordId: string, title: string, position: { x: number, y: number, z: number } }`。

- [ ] **Step 1: 写失败测试，锁定数量、顺序和坐标复制行为**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  SPATIAL_NODE_SLOTS,
  mapRecordsToSpatialNodes,
} from "../src/universe/spatial-node-layout.mjs";

const records = [
  { id: "new.md", title: "现在", visibility: "public" },
  { id: "middle.md", title: "路径", visibility: "public" },
  { id: "old.md", title: "起点", visibility: "public" },
  { id: "extra.md", title: "不展示", visibility: "public" },
];

test("maps at most one public record into each fixed spatial slot", () => {
  const nodes = mapRecordsToSpatialNodes(records);
  assert.equal(nodes.length, SPATIAL_NODE_SLOTS.length);
  assert.deepEqual(nodes.map((node) => node.recordId), ["new.md", "middle.md", "old.md"]);
  assert.deepEqual(nodes[0].position, { x: 1.55, y: 1, z: 2.2 });
});

test("does not create nodes for private or incomplete records", () => {
  const nodes = mapRecordsToSpatialNodes([
    { id: "private.md", title: "隐藏", visibility: "private" },
    { id: "missing-title.md", title: "", visibility: "public" },
    { id: "valid.md", title: "可见", visibility: "public" },
  ]);
  assert.deepEqual(nodes.map((node) => node.recordId), ["valid.md"]);
});

test("returns fresh position objects so consumers cannot mutate slot constants", () => {
  const [node] = mapRecordsToSpatialNodes(records);
  node.position.x = 999;
  assert.equal(SPATIAL_NODE_SLOTS[0].position.x, 1.55);
});
```

- [ ] **Step 2: 运行测试，确认模块尚不存在**

Run: `node --test tests/universe-spatial-node-layout.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `spatial-node-layout.mjs`.

- [ ] **Step 3: 实现固定槽位和纯映射函数**

```js
export const SPATIAL_NODE_SLOTS = Object.freeze([
  Object.freeze({ id: "vortex-primary", position: Object.freeze({ x: 1.55, y: 1.0, z: 2.2 }) }),
  Object.freeze({ id: "vortex-secondary", position: Object.freeze({ x: 2.05, y: 0.42, z: 0.35 }) }),
  Object.freeze({ id: "vortex-tertiary", position: Object.freeze({ x: 1.1, y: -0.22, z: -1.4 }) }),
]);

export function mapRecordsToSpatialNodes(records, slots = SPATIAL_NODE_SLOTS) {
  return records
    .filter((record) => record?.visibility === "public" && record.id && String(record.title).trim())
    .slice(0, slots.length)
    .map((record, index) => ({
      id: slots[index].id,
      recordId: record.id,
      title: record.title,
      position: { ...slots[index].position },
    }));
}
```

- [ ] **Step 4: 运行单测和内容验证**

Run: `node --test tests/universe-spatial-node-layout.test.mjs && node scripts/validate-content.mjs`

Expected: 3 tests PASS；内容验证输出 `Validated 3 public star nodes.`。

- [ ] **Step 5: 提交数据模型**

```bash
git add src/universe/spatial-node-layout.mjs tests/universe-spatial-node-layout.test.mjs
git commit -m "feat: map records to fixed spatial node slots"
```

---

### Task 2: 建立可访问的节点 DOM 层和3D投影

**Files:**
- Create: `src/universe/spatial-node-layer.mjs`
- Create: `tests/universe-spatial-node-layer.test.mjs`
- Modify: `index.html:24-26`
- Modify: `tests/app-shell.test.mjs:5-12`

**Interfaces:**
- Consumes: `createSpatialNodeLayer({ THREE, container, nodes, onSelect })`。
- Produces: `{ update(camera, viewport), setMode(mode, activeId?), focusNode(id), destroy() }`。
- Calls: `onSelect(node)` only while mode is `active`。

- [ ] **Step 1: 更新 shell 测试，要求唯一节点容器且不恢复旧导航**

```js
test("exploration shell exposes only the spatial content node layer", () => {
  const html = readFileSync("index.html", "utf8");
  assert.match(html, /id="intro-screen"/);
  assert.match(html, /id="universe-canvas"/);
  assert.match(html, /id="universe-nodes"/);
  assert.match(html, /id="reading-overlay"/);
  assert.doesNotMatch(html, /hidden-nav|interaction-hint|星路导航|STAR ROAD|2026\//);
});
```

- [ ] **Step 2: 写节点层失败测试**

测试必须使用项目现有的轻量 fake DOM 风格，覆盖：

```js
test("creates one labeled button per node", () => {
  const harness = createNodeLayerHarness();
  assert.equal(harness.container.children.length, 2);
  assert.equal(harness.container.children[0].tagName, "BUTTON");
  assert.equal(harness.container.children[0].ariaLabel, "现在");
  harness.layer.destroy();
});

test("projects visible nodes and hides nodes behind the camera", () => {
  const harness = createNodeLayerHarness();
  harness.projected.set("vortex-primary", { x: 0.5, y: -0.25, z: 0.2 });
  harness.projected.set("vortex-secondary", { x: 0, y: 0, z: 1.2 });
  harness.layer.update(harness.camera, { width: 1200, height: 800 });
  assert.equal(harness.buttons[0].hidden, false);
  assert.equal(harness.buttons[0].style.transform, "translate3d(900px, 500px, 0)");
  assert.equal(harness.buttons[1].hidden, true);
});

test("ignores duplicate selection while focusing", () => {
  const harness = createNodeLayerHarness();
  harness.layer.setMode("focusing", "vortex-primary");
  harness.buttons[1].dispatch("click");
  assert.equal(harness.selections.length, 0);
});

test("destroy removes buttons and listeners", () => {
  const harness = createNodeLayerHarness();
  harness.layer.destroy();
  assert.equal(harness.container.children.length, 0);
  assert.equal(harness.buttons.every((button) => button.listenerCount() === 0), true);
});
```

- [ ] **Step 3: 运行目标测试，确认失败**

Run: `node --test tests/app-shell.test.mjs tests/universe-spatial-node-layer.test.mjs`

Expected: shell test FAIL because `#universe-nodes` is absent；node layer test FAIL with `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 4: 在 canvas 后加入空节点层**

```html
<canvas id="universe-canvas" class="universe-canvas" aria-hidden="true"></canvas>
<div
  class="spatial-node-layer"
  id="universe-nodes"
  aria-label="空间内容节点"
></div>
```

- [ ] **Step 5: 实现节点创建、投影和状态锁**

核心实现必须遵守以下完整行为：

```js
const INTERACTIVE_MODES = new Set(["active"]);

export function isProjectedPointVisible({ x, y, z }) {
  return z >= -1 && z <= 1 && x >= -1 && x <= 1 && y >= -1 && y <= 1;
}

export function ndcToViewport({ x, y }, { width, height }) {
  return {
    x: Math.round((x * 0.5 + 0.5) * width),
    y: Math.round((-y * 0.5 + 0.5) * height),
  };
}

export function createSpatialNodeLayer({ THREE, container, nodes, onSelect }) {
  let mode = "active";
  let activeId = null;
  const entries = nodes.map((node) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "spatial-node";
    button.dataset.nodeId = node.id;
    button.setAttribute("aria-label", node.title);
    button.innerHTML = `<span class="spatial-node__mark" aria-hidden="true"></span><span class="spatial-node__label"></span>`;
    button.querySelector(".spatial-node__label").textContent = node.title;
    const select = () => {
      if (INTERACTIVE_MODES.has(mode)) onSelect?.(node);
    };
    button.addEventListener("click", select);
    container.append(button);
    return { node, button, select, world: new THREE.Vector3(node.position.x, node.position.y, node.position.z) };
  });

  function setMode(nextMode, nextActiveId = null) {
    mode = nextMode;
    activeId = nextActiveId;
    container.dataset.mode = mode;
    for (const entry of entries) {
      entry.button.dataset.active = String(entry.node.id === activeId);
      entry.button.disabled = !INTERACTIVE_MODES.has(mode);
    }
  }

  function update(camera, viewport) {
    camera.updateMatrixWorld?.(true);
    for (const entry of entries) {
      const projected = entry.world.clone().project(camera);
      const visible = isProjectedPointVisible(projected);
      entry.button.hidden = !visible;
      if (!visible) continue;
      const point = ndcToViewport(projected, viewport);
      entry.button.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
    }
  }

  function focusNode(id) {
    entries.find((entry) => entry.node.id === id)?.button.focus({ preventScroll: true });
  }

  function destroy() {
    for (const entry of entries) {
      entry.button.removeEventListener("click", entry.select);
      entry.button.remove();
    }
  }

  setMode("active");
  return { update, setMode, focusNode, destroy };
}
```

- [ ] **Step 6: 运行目标测试**

Run: `node --test tests/app-shell.test.mjs tests/universe-spatial-node-layer.test.mjs`

Expected: all target tests PASS。

- [ ] **Step 7: 提交节点交互层**

```bash
git add index.html src/universe/spatial-node-layer.mjs tests/app-shell.test.mjs tests/universe-spatial-node-layer.test.mjs
git commit -m "feat: add projected spatial node layer"
```

---

### Task 3: 用纯函数定义可逆镜头过渡

**Files:**
- Create: `src/universe/focus-transition.mjs`
- Create: `tests/universe-focus-transition.test.mjs`

**Interfaces:**
- Produces: `createFocusTransition({ fromPose, toPose, durationMs })`。
- Produces: `sampleFocusTransition(transition, elapsedMs)` → `{ done, progress, pose }`。
- Pose shape: `{ position: {x,y,z}, quaternion: {x,y,z,w} }`。

- [ ] **Step 1: 写失败测试覆盖端点、最短四元数路径和非法时长**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  createFocusTransition,
  sampleFocusTransition,
} from "../src/universe/focus-transition.mjs";

const fromPose = {
  position: { x: 0, y: 1, z: 5 },
  quaternion: { x: 0, y: 0, z: 0, w: 1 },
};
const toPose = {
  position: { x: 1, y: 2, z: 1 },
  quaternion: { x: 0, y: 0.5, z: 0, w: 0.8660254 },
};

test("samples the exact start and end poses", () => {
  const transition = createFocusTransition({ fromPose, toPose, durationMs: 1400 });
  assert.deepEqual(sampleFocusTransition(transition, 0).pose, fromPose);
  const end = sampleFocusTransition(transition, 1400);
  assert.equal(end.done, true);
  assert.deepEqual(end.pose, toPose);
});

test("uses eased progress and normalized quaternion interpolation", () => {
  const transition = createFocusTransition({ fromPose, toPose, durationMs: 1400 });
  const middle = sampleFocusTransition(transition, 700);
  const q = middle.pose.quaternion;
  assert.equal(middle.progress, 0.5);
  assert.ok(Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 1e-8);
});

test("rejects a non-positive transition duration", () => {
  assert.throws(
    () => createFocusTransition({ fromPose, toPose, durationMs: 0 }),
    /durationMs must be positive/,
  );
});
```

- [ ] **Step 2: 运行测试，确认模块尚不存在**

Run: `node --test tests/universe-focus-transition.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 3: 实现平滑位置插值和最短路径 nlerp**

```js
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smoothstep = (value) => value * value * (3 - 2 * value);
const mix = (from, to, amount) => from + (to - from) * amount;

function interpolatePosition(from, to, amount) {
  return {
    x: mix(from.x, to.x, amount),
    y: mix(from.y, to.y, amount),
    z: mix(from.z, to.z, amount),
  };
}

function interpolateQuaternion(from, to, amount) {
  const dot = from.x * to.x + from.y * to.y + from.z * to.z + from.w * to.w;
  const sign = dot < 0 ? -1 : 1;
  const value = {
    x: mix(from.x, to.x * sign, amount),
    y: mix(from.y, to.y * sign, amount),
    z: mix(from.z, to.z * sign, amount),
    w: mix(from.w, to.w * sign, amount),
  };
  const length = Math.hypot(value.x, value.y, value.z, value.w) || 1;
  return { x: value.x / length, y: value.y / length, z: value.z / length, w: value.w / length };
}

export function createFocusTransition({ fromPose, toPose, durationMs }) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new RangeError("durationMs must be positive");
  }
  return { fromPose, toPose, durationMs };
}

export function sampleFocusTransition(transition, elapsedMs) {
  const linear = clamp01(elapsedMs / transition.durationMs);
  const progress = smoothstep(linear);
  if (linear === 0) return { done: false, progress: 0, pose: transition.fromPose };
  if (linear === 1) return { done: true, progress: 1, pose: transition.toPose };
  return {
    done: false,
    progress,
    pose: {
      position: interpolatePosition(transition.fromPose.position, transition.toPose.position, progress),
      quaternion: interpolateQuaternion(transition.fromPose.quaternion, transition.toPose.quaternion, progress),
    },
  };
}
```

- [ ] **Step 4: 运行目标测试**

Run: `node --test tests/universe-focus-transition.test.mjs`

Expected: 3 tests PASS。

- [ ] **Step 5: 提交过渡数学**

```bash
git add src/universe/focus-transition.mjs tests/universe-focus-transition.test.mjs
git commit -m "feat: add reversible camera focus interpolation"
```

---

### Task 4: 把聚焦、阅读和返回纳入 UniverseRuntime

**Files:**
- Modify: `src/universe/experience-state.mjs:1-14`
- Modify: `src/universe/runtime.mjs:1-206`
- Modify: `tests/universe-experience-state.test.mjs`
- Modify: `tests/universe-runtime.test.mjs`
- Modify: `tests/universe-runtime-contract.test.mjs`

**Interfaces:**
- Adds: `focusOn({ target, stopDistance = 1.35, durationMs = 1350 }) → Promise<void>`。
- Adds: `returnFromFocus({ durationMs = 900 }) → Promise<void>`。
- Adds runtime snapshot fields: `focusProgress`, `focusTarget`, mode `focusing | content | returning`。
- Preserves: `start()`, `pause()`, `resume()`, `destroy()`, `requestHandoff()`。

- [ ] **Step 1: 写状态机失败测试**

```js
test("moves from active through focus, content, return, and back to active", () => {
  let state = { mode: "active", previousMode: "handoff", error: null };
  state = transitionExperience(state, { type: "FOCUS_STARTED" });
  assert.equal(state.mode, "focusing");
  state = transitionExperience(state, { type: "FOCUS_FINISHED" });
  assert.equal(state.mode, "content");
  state = transitionExperience(state, { type: "RETURN_STARTED" });
  assert.equal(state.mode, "returning");
  state = transitionExperience(state, { type: "RETURN_FINISHED" });
  assert.equal(state.mode, "active");
});

test("ignores duplicate focus and return events", () => {
  const focusing = { mode: "focusing", previousMode: "active", error: null };
  assert.equal(transitionExperience(focusing, { type: "FOCUS_STARTED" }), focusing);
  const active = { mode: "active", previousMode: "returning", error: null };
  assert.equal(transitionExperience(active, { type: "RETURN_STARTED" }), active);
});
```

- [ ] **Step 2: 写 runtime 失败测试**

在现有 `createRuntimeHarness` 中记录 `inputRouter.activate/deactivate` 调用，并补齐 fake Three 的 `Vector3`、`Matrix4`、`Quaternion` 或注入 `createFocusPose`。测试必须覆盖：

```js
test("focus locks input, reaches content, and return restores the exact pose", async () => {
  const harness = createRuntimeHarness();
  harness.runtime.start();
  harness.finishIntro();
  const before = harness.runtime.getSnapshot();
  const focused = harness.runtime.focusOn({ target: { x: 1.55, y: 1, z: 2.2 }, durationMs: 300 });
  assert.equal(harness.runtime.getSnapshot().mode, "focusing");
  harness.runFrame(100);
  harness.runFrame(200);
  harness.runFrame(300);
  await focused;
  assert.equal(harness.runtime.getSnapshot().mode, "content");

  const returned = harness.runtime.returnFromFocus({ durationMs: 300 });
  harness.runFrame(400);
  harness.runFrame(500);
  harness.runFrame(600);
  await returned;
  const after = harness.runtime.getSnapshot();
  assert.equal(after.mode, "active");
  assert.deepEqual(after.position, before.position);
  assert.deepEqual(after.quaternion, before.quaternion);
});

test("reduced motion enters content without a camera journey", async () => {
  const harness = createRuntimeHarness({ reducedMotion: true });
  harness.runtime.start();
  harness.finishIntro();
  const before = harness.runtime.getSnapshot();
  await harness.runtime.focusOn({ target: { x: 1.55, y: 1, z: 2.2 } });
  const after = harness.runtime.getSnapshot();
  assert.equal(after.mode, "content");
  assert.deepEqual(after.position, before.position);
});

test("destroy rejects an unfinished focus and releases input", async () => {
  const harness = createRuntimeHarness();
  harness.runtime.start();
  harness.finishIntro();
  const focusing = harness.runtime.focusOn({ target: { x: 1.55, y: 1, z: 2.2 } });
  harness.runtime.destroy();
  await assert.rejects(focusing, /runtime destroyed/);
  assert.equal(harness.input.destroyCalls, 1);
});
```

- [ ] **Step 3: 运行目标测试，确认失败**

Run: `node --test tests/universe-experience-state.test.mjs tests/universe-runtime.test.mjs tests/universe-runtime-contract.test.mjs`

Expected: FAIL because the new modes and APIs are absent。

- [ ] **Step 4: 扩展状态机**

```js
const TRANSITIONS = {
  loading: { LOADED: "ready" },
  ready: { INTRO_STARTED: "intro" },
  intro: {
    INTRO_FINISHED: "handoff",
    USER_INPUT: "handoff",
    REDUCED_MOTION: "handoff",
    SUSPEND: "suspended",
  },
  handoff: { HANDOFF_FINISHED: "active", SUSPEND: "suspended" },
  active: { FOCUS_STARTED: "focusing", PAUSE: "paused", SUSPEND: "suspended" },
  focusing: { FOCUS_FINISHED: "content", FOCUS_FAILED: "active" },
  content: { RETURN_STARTED: "returning" },
  returning: { RETURN_FINISHED: "active", RETURN_FAILED: "active" },
  paused: { RESUME: "active" },
  suspended: { RESUME: "active" },
};
```

- [ ] **Step 5: 在 runtime 中实现单一 PlayerRig 聚焦控制**

实现要点必须全部落在 `runtime.mjs`：

```js
let focusTransition = null;
let focusOrigin = null;
let focusResolve = null;
let focusReject = null;

function currentPose() {
  return {
    position: { ...flightState.position },
    quaternion: { ...flightState.quaternion },
  };
}

function applyPose(pose) {
  flightState = {
    ...flightState,
    position: { ...pose.position },
    quaternion: { ...pose.quaternion },
    velocity: { x: 0, y: 0, z: 0 },
  };
}

function focusOn({ target, stopDistance = 1.35, durationMs = 1350 }) {
  if (experience.mode !== "active") return Promise.reject(new Error("runtime is not active"));
  focusOrigin = currentPose();
  const toPose = createTargetPose({ THREE, fromPose: focusOrigin, target, stopDistance });
  experience = transitionExperience(experience, { type: "FOCUS_STARTED" });
  inputRouter.deactivate();
  focusTransition = createFocusTransition({ fromPose: focusOrigin, toPose, durationMs });
  focusTransition.startedAt = null;
  return new Promise((resolve, reject) => {
    focusResolve = resolve;
    focusReject = reject;
  });
}

function returnFromFocus({ durationMs = 900 } = {}) {
  if (experience.mode !== "content" || !focusOrigin) {
    return Promise.reject(new Error("runtime is not showing content"));
  }
  experience = transitionExperience(experience, { type: "RETURN_STARTED" });
  focusTransition = createFocusTransition({ fromPose: currentPose(), toPose: focusOrigin, durationMs });
  focusTransition.startedAt = null;
  return new Promise((resolve, reject) => {
    focusResolve = resolve;
    focusReject = reject;
  });
}
```

在 `frame()` 中，只有 `active/intro/handoff` 执行自由飞行 `step()`；`focusing/returning` 采样 `focusTransition`，完成时发送对应状态事件；`content` 只渲染，不消费输入。reduced-motion 分支直接保存原姿态并切到 `content`。`destroy()` 必须用 `Error("runtime destroyed")` 拒绝未完成 Promise。

- [ ] **Step 6: 更新 runtime contract 测试**

继续断言 `star-field.mjs` 不直接写 `camera.position`、`camera.quaternion` 或 `camera.lookAt`，并新增断言：

```js
assert.match(runtimeSource, /focusOn/);
assert.match(runtimeSource, /returnFromFocus/);
assert.doesNotMatch(starFieldSource, /camera\.(position|quaternion|lookAt)\s*[.=]/);
```

- [ ] **Step 7: 运行 runtime 测试**

Run: `node --test tests/universe-experience-state.test.mjs tests/universe-runtime.test.mjs tests/universe-runtime-contract.test.mjs`

Expected: all target tests PASS。

- [ ] **Step 8: 提交 runtime 状态流**

```bash
git add src/universe/experience-state.mjs src/universe/runtime.mjs tests/universe-experience-state.test.mjs tests/universe-runtime.test.mjs tests/universe-runtime-contract.test.mjs
git commit -m "feat: add runtime-owned node focus journey"
```

---

### Task 5: 连接节点、相机、内容和低速背景

**Files:**
- Modify: `src/app.mjs:9-89`
- Modify: `src/star-field.mjs:1-176`
- Modify: `src/reading-overlay.mjs:51-82`
- Create: `tests/reading-overlay.test.mjs`
- Modify: `tests/star-field-controls.test.mjs`

**Interfaces:**
- `createStarField` adds inputs: `nodeContainer`, `nodes`, `onSelect`。
- `createStarField` returns: `returnFromContent()` in addition to runtime and quality APIs。
- `createReadingOverlay` calls `onClose(activeRecord)` after its exit transition and restores focus through `returnFocus` callback。

- [ ] **Step 1: 写 reading overlay 生命周期失败测试**

```js
test("opens content safely and reports the closed record after exit", async () => {
  const harness = createReadingHarness();
  const record = { id: "now.md", date: "2026-07-16", title: "现在", summary: "摘要", body: "正文" };
  harness.reader.open(record, { returnFocus: harness.trigger });
  assert.equal(harness.overlay.classList.contains("is-open"), true);
  assert.equal(harness.content.focusCalls, 1);

  await harness.reader.close();
  assert.deepEqual(harness.closedRecords, [record]);
  assert.equal(harness.trigger.focusCalls, 1);
  assert.equal(harness.overlay.getAttribute("aria-hidden"), "true");
});

test("ignores repeated close calls", async () => {
  const harness = createReadingHarness();
  harness.reader.open({ id: "now.md", date: "2026-07-16", title: "现在", body: "正文" });
  await Promise.all([harness.reader.close(), harness.reader.close()]);
  assert.equal(harness.closedRecords.length, 1);
});
```

- [ ] **Step 2: 写 star-field 集成失败测试**

```js
test("updates projected nodes without changing ink world construction", async () => {
  const source = await readFile(new URL("../src/star-field.mjs", import.meta.url), "utf8");
  assert.match(source, /createSpatialNodeLayer/);
  assert.match(source, /nodeLayer\.update/);
  assert.match(source, /inkWorld\.update\(state\.worldTime\)/);
  assert.doesNotMatch(source, /scene\.add\([^)]*node/i);
});

test("keeps the world at 18 percent animation speed while content is open", () => {
  const clock = createWorldClock();
  clock.step(1000, "active");
  clock.step(2000, "content");
  assert.equal(clock.time, 1180);
});
```

- [ ] **Step 3: 运行目标测试，确认失败**

Run: `node --test tests/reading-overlay.test.mjs tests/star-field-controls.test.mjs`

Expected: FAIL because the lifecycle and node integration are absent。

- [ ] **Step 4: 在 app 中直接映射 records，不再生成未使用的旧 route layout**

关键组装代码：

```js
const nodeContainer = requireElement("#universe-nodes");

const [
  { loadRecords },
  { createIntroController },
  { createReadingOverlay },
  { createStarField },
  { mapRecordsToSpatialNodes },
] = await Promise.all([
  import("./record-content.mjs?v=universe-map-4"),
  import("./intro-controller.mjs?v=universe-map-4"),
  import("./reading-overlay.mjs?v=universe-map-4"),
  import("./star-field.mjs?v=3d-scene-26"),
  import("./universe/spatial-node-layout.mjs?v=3d-scene-26"),
]);

const records = await loadRecords();
const recordsById = new Map(records.map((record) => [record.id, record]));
const nodes = mapRecordsToSpatialNodes(records);
let activeNode = null;

const reader = createReadingOverlay({
  overlayElement: readingOverlay,
  contentElement: readingContent,
  closeButton: readingClose,
  onClose: async () => {
    await starField?.returnFromContent?.();
    activeNode = null;
  },
});

starField = await createStarField({
  canvas,
  nodeContainer,
  nodes,
  intro,
  onSelect: (node) => {
    const record = recordsById.get(node.recordId);
    if (!record) return;
    activeNode = node;
    reader.open(record, { returnFocus: nodeContainer.querySelector(`[data-node-id="${node.id}"]`) });
  },
  onError: showFallback,
});
```

- [ ] **Step 5: 在 star-field 中组装节点层和聚焦动作**

必须实现以下顺序：

```js
const nodeLayer = createSpatialNodeLayer({
  THREE,
  container: nodeContainer,
  nodes,
  onSelect: async (node) => {
    nodeLayer.setMode("focusing", node.id);
    try {
      await runtime.focusOn({ target: node.position, stopDistance: 1.35, durationMs: 1350 });
      nodeLayer.setMode("content", node.id);
      onSelect?.(node);
    } catch (error) {
      nodeLayer.setMode("active");
      reportError(error);
    }
  },
});

function animateWorld(time, { experience }) {
  const delta = state.lastFrameTime ? Math.max(0, time - state.lastFrameTime) : 0;
  if (state.lastFrameTime) frameMonitor.push(delta);
  state.lastFrameTime = time;
  state.worldTime += delta * (experience.mode === "content" ? 0.18 : 1);
  inkWorld.update(state.worldTime);
  scene.updateMatrixWorld(true);
  nodeLayer.update(camera, {
    width: canvas.clientWidth || window.innerWidth,
    height: canvas.clientHeight || window.innerHeight,
  });
  // 保留现有 quality.observe 逻辑
}

async function returnFromContent() {
  nodeLayer.setMode("returning");
  await runtime.returnFromFocus({ durationMs: 900 });
  nodeLayer.setMode("active");
}
```

`destroy()` 必须先 `nodeLayer.destroy()`，再销毁 runtime、world 和 renderer。发生节点层构造错误时报告错误并继续运行无节点场景，不能触发 WebGL fallback。

- [ ] **Step 6: 修改 reading overlay，使 close() 可等待且只执行一次**

`close()` 必须：保存当前 record 与 return-focus 元素；移除 `is-open`；设置 `aria-hidden="true"`；等待 `transitionend` 或 `300ms` 安全超时；调用一次 `onClose(record)`；最后恢复按钮焦点。正文仍通过 `escapeHtml` 与 `renderMarkdown` 生成，不能用未转义内容替换。

- [ ] **Step 7: 运行集成测试和完整测试**

Run: `node --test tests/reading-overlay.test.mjs tests/star-field-controls.test.mjs tests/app-shell.test.mjs && node --test tests/*.test.mjs`

Expected: target tests PASS；full suite PASS with no failures。

- [ ] **Step 8: 提交系统集成**

```bash
git add src/app.mjs src/star-field.mjs src/reading-overlay.mjs tests/reading-overlay.test.mjs tests/star-field-controls.test.mjs
git commit -m "feat: connect spatial nodes to reading journey"
```

---

### Task 6: 落实克制节点视觉和无卡片感阅读过渡

**Files:**
- Modify: `styles.css:1-64`
- Modify: `styles.css:721-853`
- Modify: `tests/app-shell.test.mjs`

**Interfaces:**
- CSS state inputs: `.spatial-node-layer[data-mode]`, `.spatial-node[data-active]`, `:hover`, `:focus-visible`。
- No JavaScript color constants；全部颜色复用 `--text`、`--muted`、`--faint`、`--ice`、`--ice-strong`。

- [ ] **Step 1: 写静态视觉契约失败测试**

```js
test("spatial nodes use restrained persistent labels and reduced motion", () => {
  const styles = readFileSync("styles.css", "utf8");
  assert.match(styles, /\.spatial-node-layer/);
  assert.match(styles, /\.spatial-node__label/);
  assert.match(styles, /font-size:\s*12px/);
  assert.match(styles, /opacity:\s*0\.38/);
  assert.match(styles, /scale\(1\.34\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /spatial-node[^}]*#[a-f\d]{3,8}/i);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test tests/app-shell.test.mjs`

Expected: FAIL because node styles are absent。

- [ ] **Step 3: 添加节点层和节点状态 CSS**

```css
.spatial-node-layer {
  position: absolute;
  inset: 0;
  z-index: 4;
  overflow: hidden;
  pointer-events: none;
}

.spatial-node {
  position: absolute;
  top: 0;
  left: 0;
  width: 36px;
  height: 36px;
  padding: 0;
  color: var(--text);
  background: transparent;
  border: 0;
  cursor: pointer;
  pointer-events: auto;
  transform-origin: 0 0;
}

.spatial-node__mark,
.spatial-node__mark::after {
  position: absolute;
  top: 50%;
  left: 50%;
  content: "";
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.spatial-node__mark {
  width: 6px;
  height: 6px;
  background: var(--ice-strong);
  box-shadow: 0 0 10px rgba(var(--ice-rgb), 0.42);
  animation: spatial-node-breathe 4s ease-in-out infinite;
}

.spatial-node__mark::after {
  width: 20px;
  height: 20px;
  border: 1px solid rgba(var(--ice-strong-rgb), 0.28);
  transition: transform 260ms var(--ease-out), opacity 260ms var(--ease-out);
}

.spatial-node__label {
  position: absolute;
  top: 50%;
  left: 29px;
  width: max-content;
  max-width: 180px;
  color: var(--text);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  opacity: 0.38;
  transform: translateY(-50%) scale(1);
  transform-origin: left center;
  transition: transform 260ms var(--ease-out), opacity 260ms var(--ease-out);
}

.spatial-node:hover .spatial-node__label,
.spatial-node:focus-visible .spatial-node__label {
  opacity: 0.96;
  transform: translateY(-50%) scale(1.34);
}

.spatial-node:hover .spatial-node__mark::after,
.spatial-node:focus-visible .spatial-node__mark::after {
  opacity: 0.72;
  transform: translate(-50%, -50%) scale(1.12);
}

.spatial-node-layer[data-mode="focusing"] .spatial-node:not([data-active="true"]),
.spatial-node-layer[data-mode="content"] .spatial-node,
.spatial-node-layer[data-mode="returning"] .spatial-node {
  opacity: 0;
  pointer-events: none;
}

@keyframes spatial-node-breathe {
  0%, 100% { opacity: 0.72; transform: translate(-50%, -50%) scale(0.94); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.06); }
}
```

- [ ] **Step 4: 调整阅读层为连续展开而不是新卡片**

保留 `.reading-overlay` 全屏结构，修改为：背景遮罩透明度不超过 `0.72`；`.reading-content` 边框透明度降到 `0.08`，背景透明度不高于 `0.52`；进入时从 `translateY(10px) scale(0.985)` 到原位；退出使用同一 `260ms` 时长。不得加入新的圆角面板、侧栏或顶部导航。

- [ ] **Step 5: 加入 reduced-motion 覆盖**

```css
@media (prefers-reduced-motion: reduce) {
  .spatial-node__mark { animation: none; }
  .spatial-node__label,
  .spatial-node__mark::after,
  .reading-overlay,
  .reading-content { transition-duration: 80ms; }
}
```

- [ ] **Step 6: 运行 CSS 契约与完整测试**

Run: `node --test tests/app-shell.test.mjs && node --test tests/*.test.mjs`

Expected: all tests PASS。

- [ ] **Step 7: 提交视觉层**

```bash
git add styles.css tests/app-shell.test.mjs
git commit -m "feat: style restrained embedded content nodes"
```

---

### Task 7: 固定机位视觉标定、性能与回滚验收

**Files:**
- Modify only if calibration is necessary: `src/universe/spatial-node-layout.mjs`
- Modify only if a verified defect is found: directly related test or implementation file
- Create: `output/playwright/embedded-nodes-idle.png`
- Create: `output/playwright/embedded-nodes-hover.png`
- Create: `output/playwright/embedded-nodes-content.png`

**Interfaces:**
- Uses the committed APIs from Tasks 1–6；不得为了截图改动世界模块。

- [ ] **Step 1: 运行全部自动验证**

Run:

```bash
node --test tests/*.test.mjs
node scripts/validate-content.mjs
git diff baseline/online-2026-07-15-ink-universe -- src/universe/ink-world.mjs src/universe/ink-panorama.mjs src/universe/ink-color-grade.mjs src/universe/quality-profiles.mjs assets/images
```

Expected: all tests PASS；输出 `Validated 3 public star nodes.`；最后一条命令无输出。

- [ ] **Step 2: 启动静态服务器并固定桌面视口**

Run: `python3 -m http.server 8788`

Open: `http://localhost:8788/`，浏览器视口固定为 `1440 × 900`，清空缓存后重新加载。

- [ ] **Step 3: 验收入场默认状态**

完成自动入场后等待 `1s`，保存 `output/playwright/embedded-nodes-idle.png`。必须同时满足：

- 三个公开记录最多生成三个节点；至少一个节点位于初始视野。
- 默认标题始终可读，但第一视觉重心仍是水墨暴风眼。
- 没有轨道、连线、卡片、路线或新增场景光源。
- 节点未遮挡关键暴风眼中心。

如果位置不满足，只允许在 `SPATIAL_NODE_SLOTS` 中逐项调整坐标，并重新运行 Task 1 测试；不得修改 `ink-world.mjs` 或背景资产。

- [ ] **Step 4: 验收 hover 和键盘 focus**

悬停首节点并保存 `output/playwright/embedded-nodes-hover.png`。随后用 Tab 聚焦同一节点，确认视觉一致：标签视觉尺寸约 `16px`、透明度接近 1、只有该节点增强，画面本身无色调或亮度变化。

- [ ] **Step 5: 验收进入、阅读与精确返回**

点击首节点并保存 `output/playwright/embedded-nodes-content.png`。确认：

- 进入总时长在 `1.2–1.6s`。
- 没有白屏、硬切或传统弹窗弹跳。
- 内容层后仍能看见原场景，背景运动明显减缓。
- 阅读时飞行输入不生效。
- Escape 关闭后返回点击前姿态；在控制台比较前后 snapshot，位置每轴误差 `< 0.001`，四元数每分量误差 `< 0.0001`。
- 焦点回到原节点按钮。

- [ ] **Step 6: 验收 reduced-motion 和故障路径**

启用系统减少动态效果后刷新：节点不呼吸，点击只做短淡化，不执行长距离推进。临时让一条公开记录从 manifest 中消失，确认对应节点不创建且页面仍可飞行；恢复文件后重新运行内容验证。

- [ ] **Step 7: 验收性能和资源清理**

连续运行并重复打开/关闭三个节点各 `20` 次：DOM 中 `.spatial-node` 数量保持不变；没有重复事件；质量档不因节点层频繁降低；运行十分钟后没有持续增长的 animation frame、Promise 或节点元素。

- [ ] **Step 8: 最终差异和基准检查**

Run:

```bash
git status --short
git diff --stat baseline/online-2026-07-15-ink-universe...HEAD
git log --oneline baseline/online-2026-07-15-ink-universe..HEAD
```

Expected: 只有本计划列出的源码、测试、文档和验收截图；`.worktrees/` 仍保持用户原有的未跟踪状态；提交历史按任务递进且没有改写基准 tag。

- [ ] **Step 9: 提交最终标定与验收证据**

```bash
git add src/universe/spatial-node-layout.mjs tests/universe-spatial-node-layout.test.mjs output/playwright/embedded-nodes-idle.png output/playwright/embedded-nodes-hover.png output/playwright/embedded-nodes-content.png
git commit -m "test: verify embedded node visual journey"
```

如果槽位坐标无需调整，不重复暂存未改变的源码和测试，只提交三张验收截图。

---

## 发布门槛

以下条件全部满足后才能进入生产发布确认：

- [ ] 全部 Node 测试通过。
- [ ] 内容验证通过。
- [ ] 禁止修改的世界模块和全景资产与基准无差异。
- [ ] 默认、hover、阅读三张固定机位截图通过人工视觉检查。
- [ ] reduced-motion 路径通过。
- [ ] 相机精确返回容差通过。
- [ ] 连续交互与十分钟运行没有资源泄漏。
- [ ] Robin 明确批准生产部署；本计划本身不包含部署授权。

## 回滚方式

若实现期间需要放弃当前升级，保留分支记录并切回 `baseline/online-2026-07-15-ink-universe` 对应提交进行对照。不得移动或删除 baseline tag，不得执行 `git reset --hard`、force push 或改写已推送历史。生产发布后若发现回归，基于 baseline 创建恢复提交或回滚升级提交，并在执行生产发布前再次请求 Robin 确认。
