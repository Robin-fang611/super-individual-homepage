# Spatial Ink Universe Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已经确认的青蓝黑银水墨母版转化为可自由穿行、四档同构且无球壳穿帮的三维宇宙。

**Architecture:** `WorldBlueprint` 固定世界种子、主墨河、墨旋和墨域坐标；`SceneWorld` 按远景、中景、近景和光学层装配。高档使用局部体积密度，低档使用同骨架的深度墨片和解析雾；质量变化只替换表现方式，不改变世界语义。

**Tech Stack:** Three.js ShaderMaterial/Points/InstancedMesh、原生 ES Modules、WebGL、Node.js `node:test`、批准的水墨美术母版。

## Global Constraints

- 美术基准：`docs/superpowers/specs/assets/ink-universe/` 下的四张批准参考图。
- 主色只能是黑、青黑、靛蓝、神秘青和冷银；紫色、洋红和霓虹不进入基础调色板。
- 约 55%–65% 视域保持深色留白。
- 粒子感极弱；水墨密度、墨带、墨云和墨雾承担视觉体量。
- 主墨河、墨旋和主要墨域在四档中的坐标、旋向、骨架和颜色必须一致。
- 不使用单张全景图包裹球内壁；看不到球壳、极点、接缝、卡片侧面或世界终点。
- 局部体积效果必须有 Performance/Balanced 替代实现。

---

### Task 1: 固定世界蓝图与水墨调色板

**Files:**
- Create: `src/universe/ink-palette.mjs`
- Create: `src/universe/world-blueprint.mjs`
- Create: `tests/universe-world-blueprint.test.mjs`

**Interfaces:**
- Produces: `INK_PALETTE`
- Produces: `createWorldBlueprint(seed): WorldBlueprint`
- WorldBlueprint: `{ seed, river, vortex, nebulae, accentFields, playableRadius, visualRadius }`

- [ ] **Step 1: 写失败测试，锁定世界确定性和禁用紫色**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { INK_PALETTE } from "../src/universe/ink-palette.mjs";
import { createWorldBlueprint } from "../src/universe/world-blueprint.mjs";

test("keeps landmark coordinates deterministic across quality tiers", () => {
  assert.deepEqual(createWorldBlueprint(611), createWorldBlueprint(611));
  const world = createWorldBlueprint(611);
  assert.ok(world.playableRadius < world.visualRadius);
  assert.notDeepEqual(world.vortex.position, { x:0,y:0,z:0 });
});

test("uses only approved ink colors", () => {
  assert.deepEqual(Object.keys(INK_PALETTE), ["voidBlack","blueBlack","indigo","mysticCyan","mutedTeal","coldSilver"]);
  for (const value of Object.values(INK_PALETTE)) assert.match(value, /^#[0-9a-f]{6}$/i);
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/universe-world-blueprint.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 实现固定调色板和空间锚点**

```js
export const INK_PALETTE = Object.freeze({ voidBlack:"#01040a", blueBlack:"#03101b", indigo:"#0a2235", mysticCyan:"#4f9fb7", mutedTeal:"#6eb7c3", coldSilver:"#d8edf1" });
```

```js
const point = (x,y,z) => Object.freeze({ x,y,z });
export function createWorldBlueprint(seed = 611) {
  return Object.freeze({
    seed, playableRadius:80, visualRadius:112,
    river:Object.freeze({ controlPoints:Object.freeze([point(28,-34,44),point(14,-12,20),point(20,8,-4),point(42,24,-35),point(55,38,-58)]), baseRadius:7.5, silverCore:0.12 }),
    vortex:Object.freeze({ position:point(55,38,-58), axis:point(-0.25,0.55,0.79), radius:15, direction:1 }),
    nebulae:Object.freeze([
      Object.freeze({ id:"north-veil", position:point(-32,22,-18), radius:16, density:0.42, seed:917 }),
      Object.freeze({ id:"lower-ink", position:point(18,-30,-24), radius:19, density:0.48, seed:1301 }),
      Object.freeze({ id:"far-bloom", position:point(-44,-4,36), radius:14, density:0.36, seed:2027 }),
    ]),
    accentFields:Object.freeze([{ id:"silver-a", position:point(8,10,6), count:12 },{ id:"silver-b", position:point(-20,-16,24), count:9 }]),
  });
}
```

- [ ] **Step 4: 运行测试**

Run: `node --test tests/universe-world-blueprint.test.mjs`  
Expected: PASS.

- [ ] **Step 5: 提交**

```bash
git add src/universe/ink-palette.mjs src/universe/world-blueprint.mjs tests/universe-world-blueprint.test.mjs
git commit -m "feat: define deterministic ink universe blueprint"
```

### Task 2: 无缝方向性墨色深空

**Files:**
- Create: `src/universe/shaders/ink-sky-shader.mjs`
- Create: `src/universe/ink-sky.mjs`
- Create: `tests/universe-ink-sky.test.mjs`

**Interfaces:**
- Consumes: `INK_PALETTE`, `WorldBlueprint.seed`.
- Produces: `createInkSky({ THREE, palette, seed }): THREE.Mesh`
- Produces: `getInkSkyProfile(): { followsTranslation:false, particleCount:0, seamMode:"directional" }`

- [ ] **Step 1: 写失败契约测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { getInkSkyProfile } from "../src/universe/ink-sky.mjs";

test("ink sky is directional and particle free", () => {
  assert.deepEqual(getInkSkyProfile(), { followsTranslation:false, particleCount:0, seamMode:"directional" });
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/universe-ink-sky.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 实现方向采样 shader**

```js
export const inkSkyVertex = `varying vec3 vDirection; void main(){ vDirection=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
export const inkSkyFragment = `
precision highp float; varying vec3 vDirection; uniform vec3 uVoid; uniform vec3 uIndigo; uniform float uSeed;
float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7))+uSeed)*43758.5453); }
float noise(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
void main(){ vec3 d=normalize(vDirection); float wash=noise(d*2.4)+0.45*noise(d*5.7); float ink=smoothstep(0.62,1.18,wash); gl_FragColor=vec4(mix(uVoid,uIndigo,ink*0.32),1.0); }`;
```

`createInkSky` 创建背面渲染的低面数大球，但每帧把 mesh 位置复制到相机位置，因此它没有平移视差；颜色只按方向计算，不使用经纬 UV，避免极点和接缝。该球尺寸大于相机 far 需求但不承担游戏边界。

```js
import { inkSkyVertex,inkSkyFragment } from "./shaders/ink-sky-shader.mjs";
export const getInkSkyProfile=()=>({followsTranslation:false,particleCount:0,seamMode:"directional"});
export function createInkSky({THREE,palette,seed}){ const geometry=new THREE.SphereGeometry(100,32,16); const material=new THREE.ShaderMaterial({vertexShader:inkSkyVertex,fragmentShader:inkSkyFragment,side:THREE.BackSide,depthWrite:false,uniforms:{uVoid:{value:new THREE.Color(palette.voidBlack)},uIndigo:{value:new THREE.Color(palette.indigo)},uSeed:{value:seed}}}); const mesh=new THREE.Mesh(geometry,material); mesh.frustumCulled=false; mesh.onBeforeRender=(_renderer,_scene,camera)=>mesh.position.copy(camera.position); return mesh; }
```

- [ ] **Step 4: 运行测试和浏览器球面检查**

Run: `node --test tests/universe-ink-sky.test.mjs`  
Expected: PASS.  
Manual: 完整球面观察两圈，看不到 UV 接缝、上下极点和均匀星点墙。

- [ ] **Step 5: 提交**

```bash
git add src/universe/shaders/ink-sky-shader.mjs src/universe/ink-sky.mjs tests/universe-ink-sky.test.mjs
git commit -m "feat: render seamless directional ink void"
```

### Task 3: 三维主墨河与偏轴墨旋

**Files:**
- Create: `src/universe/ink-river.mjs`
- Create: `src/universe/ink-vortex.mjs`
- Create: `src/universe/shaders/ink-ribbon-shader.mjs`
- Create: `tests/universe-ink-landmarks.test.mjs`

**Interfaces:**
- Consumes: `WorldBlueprint.river`, `WorldBlueprint.vortex`, `QualityProfile`.
- Produces: `createInkRiver({ THREE, blueprint, profile }): InkLandmark`
- Produces: `createInkVortex({ THREE, blueprint, profile }): InkLandmark`
- InkLandmark: `{ object3d, applyQuality(profile), update(time,camera), dispose() }`

- [ ] **Step 1: 写失败测试，锁定四档同骨架**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createInkRiverDescriptor } from "../src/universe/ink-river.mjs";
import { createInkVortexDescriptor } from "../src/universe/ink-vortex.mjs";
import { createWorldBlueprint } from "../src/universe/world-blueprint.mjs";

test("quality changes representation but not landmark geometry", () => {
  const world = createWorldBlueprint(611);
  const low = createInkRiverDescriptor(world.river,"performance");
  const high = createInkRiverDescriptor(world.river,"cinematic");
  assert.deepEqual(low.controlPoints,high.controlPoints);
  assert.notEqual(low.representation,high.representation);
  assert.deepEqual(createInkVortexDescriptor(world.vortex,"performance").position,world.vortex.position);
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/universe-ink-landmarks.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 实现描述器和分档表示**

```js
export function createInkRiverDescriptor(river,tier){ return { controlPoints:river.controlPoints,baseRadius:river.baseRadius,silverCore:river.silverCore,representation:tier==="performance"?"depth-ribbons":tier==="balanced"?"hybrid-ribbons":"local-volume" }; }
export function createInkVortexDescriptor(vortex,tier){ return { position:vortex.position,axis:vortex.axis,radius:vortex.radius,direction:vortex.direction,representation:tier==="performance"?"layered-impostor":"flow-ribbons" }; }
```

主墨河用 `THREE.CatmullRomCurve3` 生成三维骨架。Performance/Balanced 沿曲线布置三到五层交错墨带，vertex shader 进行低频流场偏移，fragment shader 用多尺度噪声形成湿墨晕染、飞白断口和暗涡；High/Cinematic 在同曲线局部增加体积密度采样。银青内光只占截面中心约 12%，不能把墨河变成发光公路。

墨旋使用同一终点和轴向生成非对称螺旋墨带；中心保持暗，亮度向稀薄墨缘集中。Performance 使用三层有深度替身，其他档逐步增加流带和局部体积，旋向、倾角和屏幕尺寸不变。

```js
export function createInkRiver({THREE,blueprint,profile,materialFactory}){ const descriptor=createInkRiverDescriptor(blueprint.river,profile.name); const curve=new THREE.CatmullRomCurve3(descriptor.controlPoints.map((p)=>new THREE.Vector3(p.x,p.y,p.z))); const geometry=new THREE.TubeGeometry(curve,192,descriptor.baseRadius,12,false); const material=materialFactory({THREE,profile,kind:"river"}); const object3d=new THREE.Mesh(geometry,material); return {object3d,applyQuality(next){material.uniforms.uInkSteps.value=next.inkSteps; material.uniforms.uAccentRatio.value=next.accentRatio;},update(time){material.uniforms.uTime.value=time;},dispose(){geometry.dispose();material.dispose();}}; }
```

```js
export function createInkVortex({THREE,blueprint,profile,materialFactory}){ const descriptor=createInkVortexDescriptor(blueprint.vortex,profile.name); const points=Array.from({length:160},(_,index)=>{const t=index/159*5.5*Math.PI;const radius=descriptor.radius*(1-index/180);return new THREE.Vector3(descriptor.position.x+Math.cos(t)*radius,descriptor.position.y+Math.sin(t)*radius*0.55,descriptor.position.z-index*0.08);}); const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),192,1.6,8,false); const material=materialFactory({THREE,profile,kind:"vortex"}); const object3d=new THREE.Mesh(geometry,material); return {object3d,applyQuality(next){material.uniforms.uInkSteps.value=next.inkSteps;},update(time){material.uniforms.uTime.value=time*0.12;},dispose(){geometry.dispose();material.dispose();}}; }
```

- [ ] **Step 4: 运行自动和固定机位检查**

Run: `node --test tests/universe-ink-landmarks.test.mjs`  
Expected: PASS.  
Manual: 四档固定机位中主墨河与墨旋中心偏差不超过画面宽高约 2%，没有紫色、粒子河或过曝核心。

- [ ] **Step 5: 提交**

```bash
git add src/universe/ink-river.mjs src/universe/ink-vortex.mjs src/universe/shaders/ink-ribbon-shader.mjs tests/universe-ink-landmarks.test.mjs
git commit -m "feat: add spatial ink river and vortex"
```

### Task 4: 有限水墨星云域与近景介质

**Files:**
- Create: `src/universe/ink-nebula.mjs`
- Create: `src/universe/ink-medium.mjs`
- Create: `src/universe/shaders/ink-volume-shader.mjs`
- Create: `tests/universe-ink-regions.test.mjs`

**Interfaces:**
- Consumes: `WorldBlueprint.nebulae`, `accentFields`, `QualityProfile`.
- Produces: `createInkNebulaField({ THREE, regions, profile }): InkRegionHandle`
- Produces: `createNearInkMedium({ THREE, blueprint, profile }): InkRegionHandle`
- InkRegionHandle: `{ object3d, update(playerPose,time), applyQuality(profile), dispose() }`

- [ ] **Step 1: 写失败测试，限制覆盖率和银色碎点**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createInkRegionDescriptors } from "../src/universe/ink-nebula.mjs";
import { createWorldBlueprint } from "../src/universe/world-blueprint.mjs";

test("keeps ink regions finite and silver accents sparse", () => {
  const world=createWorldBlueprint(611);
  const descriptors=createInkRegionDescriptors(world,"cinematic");
  assert.equal(descriptors.nebulae.length,3);
  assert.ok(descriptors.nebulae.every((item)=>item.radius<world.playableRadius*0.3));
  assert.ok(descriptors.accentCount<=24);
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/universe-ink-regions.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 实现有限墨域和分区池**

```js
export function createInkRegionDescriptors(world,tier){ const ratio={performance:0.2,balanced:0.45,high:0.75,cinematic:1}[tier]; return { nebulae:world.nebulae.map((item)=>({ ...item,representation:tier==="performance"?"depth-slices":tier==="balanced"?"hybrid":"volume" })),accentCount:Math.round(world.accentFields.reduce((sum,item)=>sum+item.count,0)*ratio) }; }
```

每个墨域是独立包围盒，不互相大面积嵌套。体积 shader 使用对象局部坐标、多尺度噪声和流场畸变；Performance 使用三层深度墨片和解析雾。进入墨域时按相机距离降低近层不透明度，保留至少一个可见出口方向。

近景介质使用相机周围固定世界坐标分区池。墨丝离开维护范围后才回收；相机排斥半径内缩小并淡出。银色星芒上限由 `accentCount` 控制，静止时不得形成雨雪，移动时只提供轻微视差。

```js
export function createInkNebulaField({THREE,regions,profile,materialFactory}){ const group=new THREE.Group(); const entries=regions.map((region)=>{const geometry=new THREE.BoxGeometry(region.radius*2,region.radius*1.4,region.radius*1.6); const material=materialFactory({THREE,profile,kind:"nebula",seed:region.seed}); const mesh=new THREE.Mesh(geometry,material); mesh.position.set(region.position.x,region.position.y,region.position.z); group.add(mesh); return {geometry,material,mesh};}); return {object3d:group,update(playerPose,time){for(const entry of entries){entry.material.uniforms.uTime.value=time;entry.material.uniforms.uCameraPosition.value.set(playerPose.position.x,playerPose.position.y,playerPose.position.z);}},applyQuality(next){for(const entry of entries) entry.material.uniforms.uInkSteps.value=next.inkSteps;},dispose(){for(const entry of entries){entry.geometry.dispose();entry.material.dispose();}group.clear();}}; }
```

`createNearInkMedium` 使用固定种子的实例缓冲，实例数等于 `accentCount`；`update` 只回收离开相机维护半径的区块，不逐帧重新随机位置。

- [ ] **Step 4: 运行测试和穿越检查**

Run: `node --test tests/universe-ink-regions.test.mjs`  
Expected: PASS.  
Manual: 穿过三个墨域，看不到卡片侧面、近裁硬切、全屏黑雾、透明倒序或粒子雨。

- [ ] **Step 5: 提交**

```bash
git add src/universe/ink-nebula.mjs src/universe/ink-medium.mjs src/universe/shaders/ink-volume-shader.mjs tests/universe-ink-regions.test.mjs
git commit -m "feat: add traversable ink nebula regions"
```

### Task 5: 场景装配、LOD 与克制光学统一

**Files:**
- Create: `src/universe/ink-postprocessing.mjs`
- Create: `src/universe/scene-world.mjs`
- Modify: `src/universe/runtime.mjs`
- Modify: `src/star-field.mjs`
- Create: `tests/universe-scene-world.test.mjs`

**Interfaces:**
- Consumes: `WorldBlueprint`, `QualityProfile`, `PlayerPose`.
- Produces: `createSceneWorld({ THREE, scene, renderer, blueprint, profile }): SceneWorld`
- SceneWorld: `{ update(playerPose,time), applyQuality(profile), preloadTier(tier), dispose(), snapshot() }`

- [ ] **Step 1: 写失败测试，锁定层顺序和切档不移动地标**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createSceneWorldDescriptor } from "../src/universe/scene-world.mjs";
import { createWorldBlueprint } from "../src/universe/world-blueprint.mjs";

test("assembles ink layers in stable order", () => {
  const world=createWorldBlueprint(611);
  const low=createSceneWorldDescriptor(world,"performance");
  const high=createSceneWorldDescriptor(world,"cinematic");
  assert.deepEqual(low.layerOrder,["sky","landmarks","nebulae","near-medium","optics"]);
  assert.deepEqual(low.landmarkAnchors,high.landmarkAnchors);
  assert.ok(low.optics.bloomStrength<=0.18);
  assert.ok(high.optics.bloomStrength<=0.32);
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/universe-scene-world.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 实现场景描述器和装配器**

```js
export function createSceneWorldDescriptor(world,tier){ return { layerOrder:["sky","landmarks","nebulae","near-medium","optics"],landmarkAnchors:{ river:world.river.controlPoints,vortex:world.vortex.position },optics:{ bloomStrength:{performance:0,balanced:0.12,high:0.22,cinematic:0.3}[tier],exposure:{performance:0.86,balanced:0.9,high:0.92,cinematic:0.94}[tier] } }; }
```

`createSceneWorld` 按 layerOrder 创建并持有所有句柄。`applyQuality` 先预热新实现，再在 `0.3–1s` 内交叉淡化，完成后释放旧资源；所有对象复用 blueprint 坐标和种子。`ink-postprocessing.mjs` 只实现色调映射、青蓝黑银 LUT 参数和低强度 Bloom，不加入运动模糊、明显色差、镜头眩光或高强度景深。

```js
export function createSceneWorld({scene,sky,river,vortex,nebulae,nearMedium,optics,profile}){ const handles=[river,vortex,nebulae,nearMedium]; scene.add(sky,river.object3d,vortex.object3d,nebulae.object3d,nearMedium.object3d); let activeProfile=profile; return {update(playerPose,time){for(const handle of handles) handle.update?.(playerPose,time); optics.update?.(activeProfile,time);},applyQuality(next){activeProfile=next; for(const handle of handles) handle.applyQuality?.(next); optics.applyQuality?.(next);},async preloadTier(tier){return optics.preloadTier?.(tier);},snapshot(){return {tier:activeProfile.name,children:handles.length+1};},dispose(){for(const handle of handles) handle.dispose?.(); optics.dispose?.(); scene.remove(sky,river.object3d,vortex.object3d,nebulae.object3d,nearMedium.object3d); sky.geometry.dispose();sky.material.dispose();}}; }
```

- [ ] **Step 4: 接入 runtime 与原有内容对象**

runtime 每帧先更新 PlayerRig，再调用 `sceneWorld.update()`；质量变化调用 `sceneWorld.applyQuality()`。现有星路内容节点暂时作为可穿越对象保留在中景层，不重新设计其内容和交互。

- [ ] **Step 5: 运行全部测试**

Run: `node --test tests/*.test.mjs`  
Expected: PASS.

- [ ] **Step 6: 提交**

```bash
git add src/universe/ink-postprocessing.mjs src/universe/scene-world.mjs src/universe/runtime.mjs src/star-field.mjs tests/universe-scene-world.test.mjs
git commit -m "feat: assemble adaptive spatial ink world"
```

### Task 6: 固定观察点、航线和四档视觉验收

**Files:**
- Create: `src/universe/visual-qa-routes.mjs`
- Create: `tests/universe-visual-qa-routes.test.mjs`
- Create: `docs/qa/ink-universe-visual-matrix.md`
- Modify: `README.md`

**Interfaces:**
- Produces: `VISUAL_OBSERVATION_POINTS`（12个）
- Produces: `VISUAL_FLIGHT_ROUTES`（3条往返航线）

- [ ] **Step 1: 写失败测试，锁定观察点和航线全部位于边界内**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { VISUAL_OBSERVATION_POINTS, VISUAL_FLIGHT_ROUTES } from "../src/universe/visual-qa-routes.mjs";

test("defines twelve safe viewpoints and three round-trip routes", () => {
  assert.equal(VISUAL_OBSERVATION_POINTS.length,12);
  assert.equal(VISUAL_FLIGHT_ROUTES.length,3);
  for (const point of VISUAL_OBSERVATION_POINTS) assert.ok(Math.hypot(point.x,point.y,point.z)<80);
  for (const route of VISUAL_FLIGHT_ROUTES) assert.deepEqual(route.points[0],route.points.at(-1));
});
```

- [ ] **Step 2: 运行并确认失败**

Run: `node --test tests/universe-visual-qa-routes.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 定义确定性 QA 路线并添加开发模式快捷入口**

```js
export const VISUAL_OBSERVATION_POINTS=Object.freeze([
  {x:0,y:0,z:0},{x:30,y:0,z:0},{x:-30,y:0,z:0},{x:0,y:30,z:0},{x:0,y:-30,z:0},{x:0,y:0,z:30},{x:0,y:0,z:-30},{x:42,y:18,z:-20},{x:-38,y:24,z:15},{x:26,y:-34,z:18},{x:-22,y:-28,z:-32},{x:58,y:12,z:8}
]);
export const VISUAL_FLIGHT_ROUTES=Object.freeze([
  { id:"river",points:[VISUAL_OBSERVATION_POINTS[0],VISUAL_OBSERVATION_POINTS[7],VISUAL_OBSERVATION_POINTS[0]] },
  { id:"nebula",points:[VISUAL_OBSERVATION_POINTS[0],VISUAL_OBSERVATION_POINTS[8],VISUAL_OBSERVATION_POINTS[0]] },
  { id:"boundary",points:[VISUAL_OBSERVATION_POINTS[0],VISUAL_OBSERVATION_POINTS[11],VISUAL_OBSERVATION_POINTS[0]] }
]);
```

开发模式允许通过 query 参数选择观察点、航线和质量档；生产默认不显示调试 UI。

- [ ] **Step 4: 创建视觉矩阵并逐项签收**

```markdown
| 档位 | 观察点/航线 | 无球壳接缝 | 无重复墨纹 | 无卡片侧面 | 主墨河一致 | 墨旋一致 | 青蓝黑银 | 粒子克制 | 结果 |
|---|---|---|---|---|---|---|---|---|---|
```

四档在同一观察点截图；主墨河和墨旋屏幕位置偏差不得超过画面宽高约 2%。三条航线逐帧检查 LOD 闪烁、透明倒序和近裁硬切。

- [ ] **Step 5: 最终回归**

Run: `node --test tests/*.test.mjs`  
Expected: PASS.  
Run: `node scripts/validate-content.mjs`  
Expected: `Validated 3 public star nodes.`

- [ ] **Step 6: 提交**

```bash
git add src/universe/visual-qa-routes.mjs tests/universe-visual-qa-routes.test.mjs docs/qa/ink-universe-visual-matrix.md README.md
git commit -m "test: define spatial ink visual acceptance routes"
```
