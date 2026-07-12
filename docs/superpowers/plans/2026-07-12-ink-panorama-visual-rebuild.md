# 水墨全景宇宙视觉重做 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以高质量、无网格感的水墨宇宙全景穹顶替代当前粗糙的程序化背景，并以少量立体墨云、墨河和墨旋恢复可读的沉浸空间。

**Architecture:** 新增一个项目内全景贴图作为球内环境的视觉主层；`InkUniverseWorld` 只负责把该贴图放到内侧球体，并维护少量已存在的三维前景。质量档位只改变贴图采样分辨率和前景数量，所有档位始终显示相同的世界主体。

**Tech Stack:** 静态 PNG/WebP 资产、Three.js `TextureLoader` / `MeshBasicMaterial`、Node 内置测试。

## Global Constraints

- 不新增 npm 依赖，不改变第一人称飞行、触控板、球形边界和自动入场。
- 主色固定为黑、青黑、靛蓝、神秘青色与冷银；禁止紫色、洋红、霓虹和大面积粒子。
- 全景穹顶必须无网格、无 UV 接缝、无可见球壳；低档不得出现空白。
- 主资产为项目内文件，不能引用 Codex 临时路径。
- 在修改前先写失败测试；每个任务单独验证与提交。

---

### Task 1: 全景资产契约与加载器

**Files:**
- Create: `src/universe/ink-panorama.mjs`
- Create: `tests/universe-ink-panorama.test.mjs`
- Create: `assets/images/ink-universe-panorama-v1.png`

**Interfaces:**
- Produces: `getInkPanoramaAsset(profile) -> { url, resolution, worldSeed }`
- Produces: `loadInkPanorama(THREE, profile) -> Promise<Texture>`

- [ ] **Step 1: 写失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { getInkPanoramaAsset } from "../src/universe/ink-panorama.mjs";

test("all quality tiers resolve to the same panorama world with bounded texture sizes", () => {
  const performance = getInkPanoramaAsset({ name: "performance", worldSeed: 611 });
  const cinematic = getInkPanoramaAsset({ name: "cinematic", worldSeed: 611 });
  assert.equal(performance.url, cinematic.url);
  assert.equal(performance.worldSeed, cinematic.worldSeed);
  assert.ok(performance.resolution < cinematic.resolution);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `node --test tests/universe-ink-panorama.test.mjs`

Expected: `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 3: 生成并保存全景资产**

使用内置图像生成工具生成一张 3840×2160 水墨宇宙全景图并复制到 `assets/images/ink-universe-panorama-v1.png`。提示词必须包含：

```text
Use case: stylized-concept
Asset type: seamless 360-degree inner-sphere panorama for a Three.js personal universe
Primary request: an immersive eastern ink-wash galaxy and nebula world, without characters or buildings
Scene/backdrop: deep blue-black and indigo cosmos, huge flowing ink masses, wet and dry brush textures, a distant silver-blue galactic river, one restrained offset ink vortex, large-scale depth in every direction
Style/medium: premium contemporary Chinese shui-mo painting fused with cinematic deep-space concept art, no paper texture
Lighting/mood: mysterious, quiet, wuxia-like, restrained cold silver highlights
Color palette: black, blue-black, indigo, cyan, limited cold silver
Constraints: seamless-feeling wide panorama; no grid, no wireframe, no text, no people, no planets with hard edges, no empty black regions, no visible horizon, no purple, no magenta, no neon, no watermark
```

- [ ] **Step 4: 写最小加载实现**

```js
const PANORAMA_URL = "/assets/images/ink-universe-panorama-v1.png";
const RESOLUTIONS = Object.freeze({ performance: 1024, balanced: 1536, high: 2048, cinematic: 3072 });

export function getInkPanoramaAsset(profile) {
  return Object.freeze({
    url: PANORAMA_URL,
    resolution: RESOLUTIONS[profile.name] ?? RESOLUTIONS.balanced,
    worldSeed: profile.worldSeed,
  });
}
```

`loadInkPanorama` 使用 `THREE.TextureLoader`，设置 `colorSpace = THREE.SRGBColorSpace`、`minFilter = THREE.LinearMipmapLinearFilter`、`magFilter = THREE.LinearFilter`、`wrapS = THREE.RepeatWrapping`。

- [ ] **Step 5: 验证并提交**

Run: `node --test tests/universe-ink-panorama.test.mjs`

Expected: `1 pass`。

```sh
git add assets/images/ink-universe-panorama-v1.png src/universe/ink-panorama.mjs tests/universe-ink-panorama.test.mjs
git commit -m "feat: add ink universe panorama asset"
```

### Task 2: 用全景穹顶替换程序化网格背景

**Files:**
- Modify: `src/universe/ink-world.mjs`
- Modify: `tests/universe-ink-world.test.mjs`

**Interfaces:**
- Consumes: `loadInkPanorama(THREE, profile)`
- Produces: `createInkUniverseWorld({ THREE, profile }) -> { group, setQuality, update }`

- [ ] **Step 1: 写失败测试**

```js
test("uses the panorama sky shell instead of a procedural canvas sky", async () => {
  const source = await readFile(new URL("../src/universe/ink-world.mjs", import.meta.url), "utf8");
  assert.match(source, /loadInkPanorama/);
  assert.doesNotMatch(source, /makeSkyTexture/);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `node --test tests/universe-ink-world.test.mjs`

Expected: source-contract assertion fails because `makeSkyTexture` still exists.

- [ ] **Step 3: 最小替换实现**

将 `createInkUniverseWorld` 改为 `async`，等待 `loadInkPanorama` 后创建：

```js
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(plan.radius, 96, 64),
  new THREE.MeshBasicMaterial({ map: panorama, side: THREE.BackSide, depthWrite: false }),
);
```

删除 `makeSkyTexture` 与其 canvas 绘制路径。`setQuality` 只更新纹理 `anisotropy` 与已有墨云/银光 drawRange，不重建世界。

- [ ] **Step 4: 适配调用方**

在 `src/star-field.mjs` 使用 `await createInkUniverseWorld({ THREE, profile: activeProfile })`，再将 `inkWorld.group` 加到 scene。场景创建失败必须继续交给现有 `showFallback` 路径。

- [ ] **Step 5: 验证并提交**

Run: `node --test tests/universe-ink-world.test.mjs tests/star-field-controls.test.mjs`

Expected: all pass。

```sh
git add src/universe/ink-world.mjs src/star-field.mjs tests/universe-ink-world.test.mjs
git commit -m "feat: render ink universe from panorama sky"
```

### Task 3: 加粗三维墨河并减少空白

**Files:**
- Modify: `src/universe/ink-world.mjs`
- Modify: `tests/universe-ink-world.test.mjs`

**Interfaces:**
- Produces: existing `createInkUniverseWorld(...).update(time)` keeps animating foreground group.

- [ ] **Step 1: 写失败测试**

```js
test("keeps a substantial ink river and vortex in every quality tier", () => {
  for (const profile of Object.values(QUALITY_PROFILES)) {
    const plan = getInkWorldPlan(profile);
    assert.equal(plan.riverStrands, 13);
    assert.equal(plan.vortexRings, 7);
    assert.ok(plan.inkClouds >= 8);
  }
});
```

- [ ] **Step 2: 运行失败测试**

Run: `node --test tests/universe-ink-world.test.mjs`

Expected: fails until plan exposes a minimum cloud count contract.

- [ ] **Step 3: 最小视觉实现**

保留 13 条河流曲线，但用 `TubeGeometry` 生成三条宽的、半透明的墨色带，其余十条保持细线作为飞白边缘。将云团从精灵点状分布改为三组定向大尺度薄雾，位置分别覆盖前方、左上与远右，至少八个对象始终可见。墨旋固定在左后远处，避免和入场主视线重叠。

- [ ] **Step 4: 验证并提交**

Run: `node --test tests/universe-ink-world.test.mjs`

Expected: all pass。

```sh
git add src/universe/ink-world.mjs tests/universe-ink-world.test.mjs
git commit -m "feat: strengthen ink river and spatial masses"
```

### Task 4: 浏览器视觉验收与回归

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 启动本地服务**

Run: `python3 -m http.server 8788 --bind 127.0.0.1`

Expected: `Serving HTTP on 127.0.0.1 port 8788`。

- [ ] **Step 2: 验收画面**

在 `http://127.0.0.1:8788/` 等待 5 秒，检查：全景无网格/像素块；前方、左后、右侧均有水墨层次；没有大面积纯黑空白；兜底层隐藏；浏览器控制台无 error/warn。

- [ ] **Step 3: 验收控制与性能档位**

用触控板双指观察、捏合前进、WASD 平移；确认走到边界仍不能穿出。调用 `window.__starField.setQuality("performance")` 与 `setQuality("cinematic")`，确认世界构图不变、Performance 仍有全景/墨河/墨旋。

- [ ] **Step 4: 全量验证并提交文档**

Run: `node --test tests/*.test.mjs && node scripts/validate-content.mjs && git diff --check`

Expected: all tests pass, `Validated 3 public star nodes.`, no whitespace errors。

在 `README.md` 的画质说明补充“全景主体始终加载，档位只减小其分辨率与前景密度”。

```sh
git add README.md
git commit -m "docs: document panorama quality fallback"
```
