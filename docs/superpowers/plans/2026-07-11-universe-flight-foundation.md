# Universe Flight Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用第一人称自由飞行、完整球面观察和不可穿越球形软边界替换现有焦点环绕相机。

**Architecture:** 把输入、姿态、运动、边界和体验状态写成可在 Node 中测试的纯模块；浏览器运行时只负责把这些模块连接到 Three.js `PlayerRig`。`UniverseRuntime` 是唯一 RAF 和相机姿态写入者，现有 `star-field.mjs` 退化为场景装配与兼容适配层。

**Tech Stack:** 原生 ES Modules、Three.js 本地模块、Node.js `node:test`、浏览器 Wheel/Keyboard API。

## Global Constraints

- 不新增第三方依赖。
- 双指左右/上下只负责观察；触控板捏合负责前后推进；WASD 和 Space/Shift/Q/E 为辅助。
- 完整球面观察无 pitch 硬限制；不提供主动 roll；无输入时只做缓慢 roll 稳定。
- 释放输入后约 0.6–1.2 秒停止，静止十秒不得漂移。
- 软边界从约 `0.85 × Rplay` 开始，只衰减向外分量，保留切向与向内分量。
- 鼠标和移动端不纳入验收。

---

### Task 1: 输入归一化

**Files:**
- Create: `src/universe/input-router.mjs`
- Create: `tests/universe-input.test.mjs`

**Interfaces:**
- Produces: `normalizeWheelDelta(event, viewport): { x: number, y: number }`
- Produces: `wheelToInput(event, viewport): { lookX: number, lookY: number, thrust: number }`
- Produces: `createInputRouter({ target, getViewport, onInput }): { activate, deactivate, destroy, snapshot, consume }`

- [ ] **Step 1: 写失败测试，锁定 wheel、pinch 和键盘语义**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWheelDelta, wheelToInput } from "../src/universe/input-router.mjs";

test("normalizes line and page wheel deltas to pixels", () => {
  assert.deepEqual(normalizeWheelDelta({ deltaX: 2, deltaY: 3, deltaMode: 1 }, { width: 1200, height: 800 }), { x: 32, y: 48 });
  assert.deepEqual(normalizeWheelDelta({ deltaX: 1, deltaY: -1, deltaMode: 2 }, { width: 1200, height: 800 }), { x: 1200, y: -800 });
});

test("maps two-finger scroll to look and ctrl-wheel pinch to thrust", () => {
  assert.deepEqual(wheelToInput({ deltaX: 12, deltaY: -8, deltaMode: 0, ctrlKey: false }, { width: 1200, height: 800 }), { lookX: 12, lookY: -8, thrust: 0 });
  assert.deepEqual(wheelToInput({ deltaX: 0, deltaY: -6, deltaMode: 0, ctrlKey: true }, { width: 1200, height: 800 }), { lookX: 0, lookY: 0, thrust: 6 });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/universe-input.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 实现纯转换函数和输入路由器**

```js
const LINE_PX = 16;
const MAX_DELTA_PX = 240;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function normalizeWheelDelta(event, viewport) {
  const scale = event.deltaMode === 1 ? LINE_PX : event.deltaMode === 2 ? viewport.height : 1;
  return {
    x: clamp(event.deltaX * (event.deltaMode === 2 ? viewport.width : scale), -MAX_DELTA_PX, MAX_DELTA_PX),
    y: clamp(event.deltaY * scale, -MAX_DELTA_PX, MAX_DELTA_PX),
  };
}

export function wheelToInput(event, viewport) {
  const { x, y } = normalizeWheelDelta(event, viewport);
  return event.ctrlKey
    ? { lookX: 0, lookY: 0, thrust: -y }
    : { lookX: x, lookY: y, thrust: 0 };
}

export function createInputRouter({ target, getViewport, onInput }) {
  let active = false;
  const keys = new Set();
  const snapshot = { lookX: 0, lookY: 0, thrust: 0, moveRight: 0, moveForward: 0, moveUp: 0 };
  const clear = () => { keys.clear(); Object.assign(snapshot, { lookX: 0, lookY: 0, thrust: 0, moveRight: 0, moveForward: 0, moveUp: 0 }); };
  const emit = () => onInput?.({ ...snapshot, source: "trackpad-keyboard", timestamp: performance.now(), controlActive: active });
  const onWheel = (event) => { if (!active) return; event.preventDefault(); Object.assign(snapshot, wheelToInput(event, getViewport())); emit(); };
  const onKey = (event, down) => { if (!active) return; if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "Space", "ShiftLeft", "ShiftRight"].includes(event.code)) event.preventDefault(); down ? keys.add(event.code) : keys.delete(event.code); snapshot.moveForward = Number(keys.has("KeyW")) - Number(keys.has("KeyS")); snapshot.moveRight = Number(keys.has("KeyD")) - Number(keys.has("KeyA")); snapshot.moveUp = Number(keys.has("Space") || keys.has("KeyE")) - Number(keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("KeyQ")); emit(); };
  const keyDown = (event) => onKey(event, true);
  const keyUp = (event) => onKey(event, false);
  target.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", keyDown, { passive: false });
  window.addEventListener("keyup", keyUp);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", clear);
  return { activate() { active = true; }, deactivate() { active = false; clear(); }, snapshot() { return { ...snapshot }; }, consume() { const frame = { ...snapshot }; snapshot.lookX = 0; snapshot.lookY = 0; snapshot.thrust = 0; return frame; }, destroy() { target.removeEventListener("wheel", onWheel); window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", clear); document.removeEventListener("visibilitychange", clear); clear(); } };
}
```

- [ ] **Step 4: 运行输入测试**

Run: `node --test tests/universe-input.test.mjs`  
Expected: PASS.

- [ ] **Step 5: 提交**

```bash
git add src/universe/input-router.mjs tests/universe-input.test.mjs
git commit -m "feat: normalize trackpad flight input"
```

### Task 2: 完整球面朝向与 roll 稳定

**Files:**
- Create: `src/universe/orientation.mjs`
- Create: `tests/universe-orientation.test.mjs`

**Interfaces:**
- Produces: `identityQuaternion(): QuaternionLike`
- Produces: `applyLookDelta(quaternion, lookX, lookY, sensitivity): QuaternionLike`
- Produces: `forwardFromQuaternion(quaternion): Vec3`
- Produces: `stabilizeRoll(quaternion, comfortUp, dt, rate): QuaternionLike`

- [ ] **Step 1: 写失败测试，证明观察可越过极点且四元数保持归一**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { identityQuaternion, applyLookDelta, forwardFromQuaternion } from "../src/universe/orientation.mjs";

test("continues through the top without a pitch clamp", () => {
  let q = identityQuaternion();
  for (let index = 0; index < 220; index += 1) q = applyLookDelta(q, 0, 1, Math.PI / 180);
  const forward = forwardFromQuaternion(q);
  assert.ok(forward.z > 0.7, `expected to pass beyond 180 degrees, got ${JSON.stringify(forward)}`);
  assert.ok(Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 1e-9);
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/universe-orientation.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 实现最小四元数运算，不引入 pitch clamp**

```js
const normalize = (q) => { const length = Math.hypot(q.x, q.y, q.z, q.w) || 1; return { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length }; };
const multiply = (a, b) => normalize({ x: a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y, y: a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x, z: a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w, w: a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z });
const axisAngle = (axis, angle) => { const half = angle / 2; const s = Math.sin(half); return { x: axis.x*s, y: axis.y*s, z: axis.z*s, w: Math.cos(half) }; };
const dot = (a,b) => a.x*b.x+a.y*b.y+a.z*b.z;
const cross = (a,b) => ({ x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x });
const normalizeVector = (v) => { const length=Math.hypot(v.x,v.y,v.z)||1; return { x:v.x/length,y:v.y/length,z:v.z/length }; };

export const identityQuaternion = () => ({ x: 0, y: 0, z: 0, w: 1 });
export function applyLookDelta(q, lookX, lookY, sensitivity) {
  const yaw = axisAngle({ x: 0, y: 1, z: 0 }, -lookX * sensitivity);
  const pitch = axisAngle({ x: 1, y: 0, z: 0 }, -lookY * sensitivity);
  return multiply(multiply(q, yaw), pitch);
}
export function forwardFromQuaternion(q) { return { x: -2*(q.x*q.z + q.w*q.y), y: -2*(q.y*q.z - q.w*q.x), z: -(1 - 2*(q.x*q.x + q.y*q.y)) }; }
export function rotateVector(q,v){ const qv={x:q.x,y:q.y,z:q.z}; const uv=cross(qv,v); const uuv=cross(qv,uv); return { x:v.x+2*(q.w*uv.x+uuv.x),y:v.y+2*(q.w*uv.y+uuv.y),z:v.z+2*(q.w*uv.z+uuv.z) }; }
export function stabilizeRoll(q, comfortUp, dt, rate) {
  const forward=normalizeVector(forwardFromQuaternion(q));
  const currentUp=rotateVector(q,{x:0,y:1,z:0});
  const project=(v)=>normalizeVector({x:v.x-forward.x*dot(v,forward),y:v.y-forward.y*dot(v,forward),z:v.z-forward.z*dot(v,forward)});
  const from=project(currentUp),to=project(comfortUp);
  const angle=Math.atan2(dot(forward,cross(from,to)),dot(from,to));
  return multiply(axisAngle(forward,angle*(1-Math.exp(-rate*dt))),q);
}
```

测试中增加断言：`stabilizeRoll` 前后 forward 点积大于 `0.999999`。

- [ ] **Step 4: 运行朝向测试**

Run: `node --test tests/universe-orientation.test.mjs`  
Expected: PASS, including full-sphere and forward-preservation cases.

- [ ] **Step 5: 提交**

```bash
git add src/universe/orientation.mjs tests/universe-orientation.test.mjs
git commit -m "feat: support unrestricted spherical look"
```

### Task 3: 固定步长飞行与球形软边界

**Files:**
- Create: `src/universe/flight-model.mjs`
- Create: `tests/universe-flight.test.mjs`

**Interfaces:**
- Consumes: `forwardFromQuaternion(quaternion)`
- Produces: `createFlightState(options): FlightState`
- Produces: `stepFlight(state, input, dt, config): FlightState`
- Produces: `applySphericalBoundary(position, velocity, config): { position, velocity }`

- [ ] **Step 1: 写边界不变量和切向滑行失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { applySphericalBoundary } from "../src/universe/flight-model.mjs";

const config = { radius: 10, softStart: 8.5, epsilon: 1e-4 };

test("removes outward velocity but preserves tangential velocity", () => {
  const result = applySphericalBoundary({ x: 9.99, y: 0, z: 0 }, { x: 4, y: 3, z: 0 }, config);
  assert.ok(result.velocity.x < 0.01);
  assert.ok(Math.abs(result.velocity.y - 3) < 1e-9);
});

test("never returns a position outside the playable sphere", () => {
  for (let index = 0; index < 10000; index += 1) {
    const result = applySphericalBoundary({ x: 20-index/1000, y: index%3, z: 0 }, { x: 100, y: 5, z: 2 }, config);
    assert.ok(Math.hypot(result.position.x, result.position.y, result.position.z) <= config.radius-config.epsilon+1e-9);
  }
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/universe-flight.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 实现向量分解、软衰减和最终投影**

```js
const length = (v) => Math.hypot(v.x, v.y, v.z);
const scale = (v, factor) => ({ x: v.x*factor, y: v.y*factor, z: v.z*factor });
const add = (a, b) => ({ x: a.x+b.x, y: a.y+b.y, z: a.z+b.z });
const dot = (a, b) => a.x*b.x+a.y*b.y+a.z*b.z;
const smoothstep = (a, b, value) => { const t = Math.min(1, Math.max(0, (value-a)/(b-a))); return t*t*(3-2*t); };

export function applySphericalBoundary(position, velocity, { radius, softStart, epsilon }) {
  const r = length(position);
  const n = r > 0 ? scale(position, 1/r) : { x: 1, y: 0, z: 0 };
  const radial = dot(velocity, n);
  const tangent = add(velocity, scale(n, -radial));
  const outwardGain = radial > 0 ? smoothstep(radius, softStart, r) : 1;
  let nextVelocity = radial > 0 ? add(tangent, scale(n, radial*outwardGain)) : velocity;
  let nextPosition = position;
  if (r > radius-epsilon) { nextPosition = scale(n, radius-epsilon); const out = dot(nextVelocity, n); if (out > 0) nextVelocity = add(nextVelocity, scale(n, -out)); }
  return { position: nextPosition, velocity: nextVelocity };
}

export function createFlightState(options={}) { return { position:options.position??{x:0,y:0,z:0},velocity:options.velocity??{x:0,y:0,z:0},quaternion:options.quaternion??{x:0,y:0,z:0,w:1} }; }
export function stepFlight(state,input,dt,config) {
  const forward=rotateVector(state.quaternion,{x:0,y:0,z:-1});
  const right=rotateVector(state.quaternion,{x:1,y:0,z:0});
  const up=rotateVector(state.quaternion,{x:0,y:1,z:0});
  let direction=add(add(scale(right,input.moveRight),scale(forward,input.moveForward+input.thrust*config.thrustScale)),scale(up,input.moveUp));
  const magnitude=length(direction); if(magnitude>1) direction=scale(direction,1/magnitude);
  const target=scale(direction,config.maxSpeed); const rate=magnitude>0?config.accelRate:config.stopRate; const gain=1-Math.exp(-rate*dt);
  let velocity=add(state.velocity,scale(add(target,scale(state.velocity,-1)),gain));
  if(magnitude===0&&length(velocity)<config.stopEpsilon) velocity={x:0,y:0,z:0};
  const predicted=add(state.position,scale(velocity,dt)); const bounded=applySphericalBoundary(predicted,velocity,config.boundary);
  return { ...state,position:bounded.position,velocity:bounded.velocity };
}
```

在文件顶部导入 `rotateVector`。调用方对大 `dt` 拆步，单步不得超过 `1/60s`。

- [ ] **Step 4: 运行飞行测试**

Run: `node --test tests/universe-flight.test.mjs`  
Expected: PASS for outward slowdown, inward freedom, tangent preservation, random invariant and 30/60/120 Hz consistency.

- [ ] **Step 5: 提交**

```bash
git add src/universe/flight-model.mjs tests/universe-flight.test.mjs
git commit -m "feat: add bounded first-person flight model"
```

### Task 4: 体验状态机与自动交权

**Files:**
- Create: `src/universe/experience-state.mjs`
- Create: `tests/universe-experience-state.test.mjs`
- Modify: `src/intro-controller.mjs`

**Interfaces:**
- Produces: `createExperienceState(): ExperienceState`
- Produces: `transitionExperience(state, event): ExperienceState`
- Produces: `handoffWeights(elapsedMs, durationMs): { autopilot, player }`

- [ ] **Step 1: 写失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createExperienceState, transitionExperience, handoffWeights } from "../src/universe/experience-state.mjs";

test("moves through loading, autopilot, handoff and active", () => {
  let state = createExperienceState();
  for (const type of ["LOADED", "INTRO_STARTED", "INTRO_FINISHED", "HANDOFF_FINISHED"]) state = transitionExperience(state, { type });
  assert.equal(state.mode, "active");
});

test("handoff weights are continuous and complementary", () => {
  assert.deepEqual(handoffWeights(0, 400), { autopilot: 1, player: 0 });
  const middle = handoffWeights(200, 400);
  assert.ok(Math.abs(middle.autopilot+middle.player-1) < 1e-9);
  assert.deepEqual(handoffWeights(400, 400), { autopilot: 0, player: 1 });
});

test("user input and reduced motion use the same handoff path", () => {
  const intro={...createExperienceState(),mode:"intro"};
  assert.equal(transitionExperience(intro,{type:"USER_INPUT"}).mode,"handoff");
  assert.equal(transitionExperience(intro,{type:"REDUCED_MOTION"}).mode,"handoff");
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/universe-experience-state.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 实现显式状态转换并让 intro 只报告阶段**

```js
export const createExperienceState = () => ({ mode: "loading", previousMode: null, error: null });
const transitions = { loading: { LOADED: "ready" }, ready: { INTRO_STARTED: "intro" }, intro: { INTRO_FINISHED: "handoff",USER_INPUT:"handoff",REDUCED_MOTION:"handoff", SUSPEND: "suspended" }, handoff: { HANDOFF_FINISHED: "active", SUSPEND: "suspended" }, active: { PAUSE: "paused", SUSPEND: "suspended" }, paused: { RESUME: "active" }, suspended: { RESUME: "active" } };
export function transitionExperience(state, event) { if (event.type === "ERROR") return { ...state, previousMode: state.mode, mode: "error", error: event.error }; const next = transitions[state.mode]?.[event.type]; return next ? { ...state, previousMode: state.mode, mode: next } : state; }
export function handoffWeights(elapsedMs, durationMs) { const t = Math.min(1, Math.max(0, elapsedMs/durationMs)); const player = t*t*(3-2*t); return { autopilot: 1-player, player }; }
```

修改 `createIntroController`：保留文案阶段计算，但把 RAF 所有权交给 `UniverseRuntime`；新增 `setElapsed(elapsedMs)`，删除独立 RAF。`skip()` 只触发同一 `INTRO_FINISHED` 路径。

runtime 启动时读取 `matchMedia("(prefers-reduced-motion: reduce)").matches`；命中时派发 `REDUCED_MOTION`。intro 期间收到首个非零 InputFrame 时派发 `USER_INPUT`，把剩余 handoff 压缩到不超过 300 ms。

- [ ] **Step 4: 运行状态与原有 intro 测试**

Run: `node --test tests/universe-experience-state.test.mjs tests/intro-controller.test.mjs`  
Expected: PASS.

- [ ] **Step 5: 提交**

```bash
git add src/universe/experience-state.mjs src/intro-controller.mjs tests/universe-experience-state.test.mjs tests/intro-controller.test.mjs
git commit -m "feat: coordinate intro and flight handoff"
```

### Task 5: Three.js PlayerRig 与运行时集成

**Files:**
- Create: `src/universe/runtime.mjs`
- Modify: `src/star-field.mjs`
- Modify: `src/app.mjs`
- Modify: `styles.css`
- Create: `tests/universe-runtime-contract.test.mjs`

**Interfaces:**
- Consumes: input router, orientation, flight model and experience reducer.
- Produces: `createUniverseRuntime({ THREE, canvas, camera, scene, renderer, intro, onError }): RuntimeHandle`
- RuntimeHandle: `{ start, pause, resume, destroy, getSnapshot, requestHandoff }`

- [ ] **Step 1: 写静态契约测试，防止旧 Orbit 再次拥有相机**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("star-field delegates camera ownership to UniverseRuntime", async () => {
  const source = await readFile(new URL("../src/star-field.mjs", import.meta.url), "utf8");
  assert.match(source, /createUniverseRuntime/);
  assert.doesNotMatch(source, /camera\.lookAt\(focus\)/);
  assert.doesNotMatch(source, /applyOrbitInput/);
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/universe-runtime-contract.test.mjs`  
Expected: FAIL because current `star-field.mjs` still owns Orbit state.

- [ ] **Step 3: 创建唯一运行时循环**

```js
export function createUniverseRuntime({ THREE, canvas, camera, scene, renderer, intro, inputRouter, flightConfig, initialFlightState, onError }) {
  const rig = new THREE.Group();
  rig.name = "PlayerRig";
  rig.add(camera);
  scene.add(rig);
  let raf = 0, running = false, accumulator = 0, previous = performance.now(), flightState = initialFlightState;
  const fixedDt = 1/120;
  function frame(now) {
    if (!running) return;
    const elapsed = Math.min(0.1, (now-previous)/1000); previous = now; accumulator += elapsed;
    try { while (accumulator >= fixedDt) { const input=inputRouter.consume(); flightState={ ...flightState,quaternion:applyLookDelta(flightState.quaternion,input.lookX,input.lookY,flightConfig.lookSensitivity) }; flightState=stepFlight(flightState,input,fixedDt,flightConfig); accumulator -= fixedDt; } rig.position.set(flightState.position.x,flightState.position.y,flightState.position.z); rig.quaternion.set(flightState.quaternion.x,flightState.quaternion.y,flightState.quaternion.z,flightState.quaternion.w); intro?.setElapsed?.(now); renderer.render(scene, camera); raf = requestAnimationFrame(frame); }
    catch (error) { running = false; onError?.(error); }
  }
  return { start() { if (!running) { running = true; inputRouter.activate(); previous = performance.now(); raf = requestAnimationFrame(frame); } }, pause() { running = false; inputRouter.deactivate(); cancelAnimationFrame(raf); }, resume() { this.start(); }, destroy() { running = false; inputRouter.destroy(); cancelAnimationFrame(raf); rig.remove(camera); scene.remove(rig); }, requestHandoff() { inputRouter.activate(); }, getSnapshot() { return { position: rig.position.toArray(), quaternion: rig.quaternion.toArray(), running }; } };
}
```

在文件顶部导入 `applyLookDelta` 和 `stepFlight`；不得让其他模块写相机变换。

- [ ] **Step 4: 改造装配层**

`star-field.mjs` 删除 `getTrackpadOrbitDelta`、`applyOrbitInput`、Orbit 距离和 `camera.lookAt(focus)` 路径；保留场景对象、选星、pause/resume/getSnapshot/destroy，并把生命周期委托给 runtime。`app.mjs` 创建 intro 后把控制器传给 runtime；阅读浮层打开调用 `pause()`，关闭调用 `resume()`。

- [ ] **Step 5: 运行全部自动测试**

Run: `node --test tests/*.test.mjs`  
Expected: all tests PASS;旧 Orbit 契约测试被新第一人称契约替代。

- [ ] **Step 6: 本地浏览器验收**

Run: `python -m http.server 8788`  
Expected: `http://localhost:8788` 打开后自动飞入；300–500 ms 无跳变交权；双指完整球面观察；捏合前后飞行；边界减速且可切向滑行；浮层暂停恢复正常。

- [ ] **Step 7: 提交**

```bash
git add src/universe/runtime.mjs src/star-field.mjs src/app.mjs styles.css tests/universe-runtime-contract.test.mjs
git commit -m "feat: integrate first-person universe runtime"
```

### Task 6: 真实触控板矩阵与回归

**Files:**
- Create: `docs/qa/trackpad-flight-matrix.md`
- Modify: `README.md`

**Interfaces:**
- Produces: 可重复执行的 Mac/Windows 浏览器验收记录。

- [ ] **Step 1: 创建矩阵**

```markdown
| 平台 | 浏览器 | 横向观察 | 纵向越极点 | 捏合前后 | 页面不滚动 | 边缘滑行 | 交权连续 | 结果 |
|---|---|---|---|---|---|---|---|---|
| macOS | Safari | | | | | | | |
| macOS | Chrome | | | | | | | |
| Windows | Chrome | | | | | | | |
| Windows | Edge | | | | | | | |
```

- [ ] **Step 2: 跑自动回归和内容验证**

Run: `node --test tests/*.test.mjs`  
Expected: PASS.  
Run: `node scripts/validate-content.mjs`  
Expected: `Validated 3 public star nodes.`

- [ ] **Step 3: 在四个目标组合完成真机测试并记录版本、设备和结论**

不得用合成 WheelEvent 替代这一项。发现符号或灵敏度差异时，只修改 `InputRouter` 平台适配参数，不在 runtime 加浏览器分支。

- [ ] **Step 4: 提交**

```bash
git add docs/qa/trackpad-flight-matrix.md README.md
git commit -m "docs: record trackpad flight verification"
```
