// Level 4 · 雾层重做（DESIGN-ENHANCE-PLAN Level 4）
//
// 把"均匀薄纱式水墨雾"改为"多层叠加 + 墨核聚散 + Z 轴浮动"的氤氲工艺，
// 让雾气从一层均匀的纱，变成有浓淡干湿、有聚散呼吸的水墨氤氲。
//
// 设计约束：
// - 零新增依赖、不改 Three.js 版本、不重写渲染管线；
// - 不改 ice-blue / gold token 语义（雾沿用 INK_COLOR_GRADE 墨色氛围，NormalBlending，不做发光）；
// - 纯绘制函数 drawInkMist / drawInkCore 只用标准 canvas API，可在 node 中以 mock ctx 单测；
// - canvasTexture 由调用方（ink-world.mjs）注入，浏览器用 document.createElement，测试用 mock。

import { INK_COLOR_GRADE } from "./ink-color-grade.mjs";

// 薄纱层布局（原 INK_MASS_LAYOUT）：position / scale / rotation / tone(0..2)。
const INK_VEIL_LAYOUT = Object.freeze([
  { position: [0.4, -0.9, -3.2], scale: [10.8, 5.2], rotation: -0.22, tone: 0 },
  { position: [-6.8, 5.8, -5.8], scale: [12.4, 6.4], rotation: 0.48, tone: 1 },
  { position: [10.6, 1.9, -11.4], scale: [13.8, 6.6], rotation: -0.66, tone: 2 },
  { position: [-1.8, -2.3, -6.6], scale: [9.2, 4.1], rotation: 0.36, tone: 1 },
  { position: [-8.9, 3.4, -8.5], scale: [10.2, 5.5], rotation: -0.18, tone: 2 },
  { position: [8.7, 4.8, -13.5], scale: [11.6, 5.3], rotation: 0.26, tone: 0 },
  { position: [2.8, 1.4, -8.8], scale: [8.4, 4.2], rotation: -0.48, tone: 1 },
  { position: [-4.4, 7.2, -10.8], scale: [9.6, 4.7], rotation: 0.68, tone: 2 },
  { position: [3.8, -2.4, -10.9], scale: [8.8, 3.8], rotation: 0.18, tone: 0 },
  { position: [-11.1, 1.1, -11.8], scale: [9.8, 4.4], rotation: -0.35, tone: 1 },
  { position: [12.2, -1.5, -15.2], scale: [10.5, 4.8], rotation: 0.51, tone: 2 },
  { position: [-0.7, 4.6, -12.4], scale: [8.3, 3.9], rotation: -0.08, tone: 0 },
  { position: [5.7, 0.3, -15.8], scale: [8.9, 4.1], rotation: 0.62, tone: 1 },
  { position: [-10.8, 7.7, -13.2], scale: [10.1, 4.9], rotation: -0.57, tone: 2 },
  { position: [13.4, 5.5, -17.1], scale: [9.7, 4.6], rotation: 0.14, tone: 0 },
  { position: [-3.9, -4.1, -13.9], scale: [8.1, 3.7], rotation: -0.41, tone: 1 },
  { position: [1.4, 7.6, -16.5], scale: [9.3, 4.2], rotation: 0.33, tone: 2 },
  { position: [-13.3, -1.8, -15.1], scale: [8.7, 4.0], rotation: 0.47, tone: 0 },
  { position: [11.5, 8.3, -18.4], scale: [8.9, 4.3], rotation: -0.29, tone: 1 },
  { position: [-6.2, 1.2, -17.8], scale: [8.0, 3.6], rotation: 0.11, tone: 2 },
  { position: [5.2, -4.8, -17.5], scale: [7.8, 3.5], rotation: -0.63, tone: 0 },
  { position: [-1.9, 9.6, -19.4], scale: [8.5, 3.9], rotation: 0.39, tone: 1 },
]);

// 墨核：更浓的核心区域，给雾气聚散感（2-3 个，位于视场中景）。
const INK_CORE_LAYOUT = Object.freeze([
  { position: [2.4, 0.6, -7.4], scale: [5.6, 3.2], rotation: 0.2, tone: 0 },
  { position: [-7.2, 4.1, -9.6], scale: [6.4, 3.6], rotation: -0.3, tone: 1 },
  { position: [9.4, 3.2, -12.8], scale: [5.2, 3.0], rotation: 0.5, tone: 2 },
]);

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// 多层叠加薄雾：18+ 次水彩 pass，alpha 分层（部分更浓以叠出层次），
// 再叠加几处更密的"内核"pass，最后 destination-out 挖出破碎缝隙，
// 让雾读作飘散的氤氲，而非一块均匀的半透明 blob。所有径向渐变边缘收敛到透明。
export function drawInkMist(context, width, height, seed) {
  const rng = createRng(seed);
  context.clearRect(0, 0, width, height);
  context.globalCompositeOperation = "source-over";

  const palette = [
    INK_COLOR_GRADE.inkMistPrimary,
    INK_COLOR_GRADE.inkMistDeep,
    INK_COLOR_GRADE.inkMistBright,
    INK_COLOR_GRADE.inkMistShadow,
  ];

  for (let pass = 0; pass < 22; pass += 1) {
    const x = width * (0.12 + rng() * 0.76);
    const y = height * (0.15 + rng() * 0.7);
    const rx = width * (0.09 + rng() * 0.25);
    const ry = height * (0.05 + rng() * 0.16);
    const color = palette[pass % palette.length];
    // 分层不透明度：约 1/4 的 pass 更浓，制造远近浓淡。
    const dense = pass % 4 === 0;
    const alpha = (dense ? 0.075 : 0.035) + rng() * (dense ? 0.08 : 0.05);
    context.save();
    context.translate(x, y);
    context.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
    gradient.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);
    gradient.addColorStop(0.55, `${color}${Math.round(alpha * 90).toString(16).padStart(2, "0")}`);
    gradient.addColorStop(1, "#00000000");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, Math.max(rx, ry), 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  // 更密的内核 pass：在几个随机中心叠出明显更浓的墨团，形成"聚"。
  for (let core = 0; core < 4; core += 1) {
    const x = width * (0.2 + rng() * 0.6);
    const y = height * (0.25 + rng() * 0.5);
    const r = width * (0.06 + rng() * 0.1);
    const color = core % 2 === 0 ? INK_COLOR_GRADE.inkMistDeep : INK_COLOR_GRADE.inkMistPrimary;
    const gradient = context.createRadialGradient(x, y, 0, x, y, r);
    const alpha = 0.1 + rng() * 0.06;
    gradient.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);
    gradient.addColorStop(0.6, `${color}${Math.round(alpha * 40).toString(16).padStart(2, "0")}`);
    gradient.addColorStop(1, "#00000000");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }

  // 挖出破碎缝隙（destination-out），让薄雾有干湿/断开的墨韵。
  context.globalCompositeOperation = "destination-out";
  const clearRng = createRng(seed + 31);
  for (let index = 0; index < 11; index += 1) {
    const x = clearRng() * width;
    const y = clearRng() * height;
    const radius = 22 + clearRng() * 96;
    const clear = context.createRadialGradient(x, y, 0, x, y, radius);
    clear.addColorStop(0, "rgba(0,0,0,0.46)");
    clear.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = clear;
    context.fillRect(0, 0, width, height);
  }
  context.globalCompositeOperation = "source-over";
}

// 墨核纹理：集中、收尖的浓核 + 嵌入的暗色细丝，边缘收敛到透明。
// 比薄雾更密更聚，挂到少数 core sprite 上，制造雾气的"聚散"重心。
export function drawInkCore(context, width, height, seed) {
  const rng = createRng(seed);
  context.clearRect(0, 0, width, height);
  context.globalCompositeOperation = "source-over";

  const half = width / 2;
  // 主核：高不透明度峰、较小半径，向内收。
  const core = context.createRadialGradient(half, half, 0, half, half, half * 0.62);
  core.addColorStop(0, `${INK_COLOR_GRADE.inkMistPrimary}7a`);
  core.addColorStop(0.4, `${INK_COLOR_GRADE.inkMistDeep}52`);
  core.addColorStop(0.75, `${INK_COLOR_GRADE.inkMistShadow}1f`);
  core.addColorStop(1, "#00000000");
  context.fillStyle = core;
  context.fillRect(0, 0, width, height);

  // 嵌入的暗色细丝（墨丝），让"核"有被墨浸过的质感，而非均匀光斑。
  context.save();
  const wisps = 5;
  for (let index = 0; index < wisps; index += 1) {
    const angle = rng() * Math.PI * 2;
    const len = half * (0.5 + rng() * 0.4);
    const w = 6 + rng() * 10;
    context.save();
    context.translate(half, half);
    context.rotate(angle);
    const grad = context.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, `${INK_COLOR_GRADE.inkMistShadow}b0`);
    grad.addColorStop(1, "#00000000");
    context.fillStyle = grad;
    context.fillRect(0, -w / 2, len, w);
    context.restore();
  }
  context.restore();
  context.globalCompositeOperation = "source-over";
}

function makeInkTexture(THREE, seed, canvasTexture) {
  return canvasTexture(THREE, 512, 512, (context, width, height) => drawInkMist(context, width, height, seed));
}

function makeInkCoreTexture(THREE, seed, canvasTexture) {
  return canvasTexture(THREE, 512, 512, (context, width, height) => drawInkCore(context, width, height, seed));
}

// 构建墨雾组：薄纱层（多 pass 叠加纹理）+ 墨核（集中纹理），均 NormalBlending、不写深度。
// 每个子 sprite 记录 qualityIndex（供 setQuality 按画质档位开关）、phase、baseZ、zAmp（供 Z 浮动）。
export function createInkClouds(THREE, plan, { canvasTexture }) {
  const group = new THREE.Group();
  group.name = "InkMasses";
  const rng = createRng(plan.seed + 13);
  const veilTexture = makeInkTexture(THREE, plan.seed + 29, canvasTexture);
  const coreTexture = makeInkCoreTexture(THREE, plan.seed + 53, canvasTexture);

  const addSprite = (layout, texture, isCore) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      color: layout.tone === 0 ? INK_COLOR_GRADE.cloudPrimary : INK_COLOR_GRADE.cloudDeep,
      transparent: true,
      opacity: isCore
        ? 0.34 + layout.tone * 0.03 + rng() * 0.04
        : 0.18 + layout.tone * 0.025 + rng() * 0.04,
      depthWrite: false,
      blending: THREE.NormalBlending,
    }));
    sprite.position.set(...layout.position);
    sprite.scale.set(layout.scale[0], layout.scale[1], 1);
    sprite.material.rotation = layout.rotation;
    sprite.userData.qualityIndex = isCore ? 8 + (group.children.length - INK_VEIL_LAYOUT.length) : group.children.length;
    sprite.userData.phase = group.children.length * 0.73;
    sprite.userData.baseZ = layout.position[2];
    sprite.userData.zAmp = isCore ? 0.9 + rng() * 0.5 : 0.4 + rng() * 0.6;
    group.add(sprite);
  };

  for (const layout of INK_VEIL_LAYOUT) addSprite(layout, veilTexture, false);
  for (const layout of INK_CORE_LAYOUT) addSprite(layout, coreTexture, true);

  return group;
}

// 每帧更新：旋转漂移（保持原呼吸感）+ Z 轴浮动（让雾气在纵深上聚散，而非仅 XY 平移）。
export function updateInkClouds(group, time) {
  for (const cloud of group.children) {
    cloud.material.rotation += Math.sin(time * 0.0002 + cloud.userData.phase) * 0.00004;
    cloud.position.z = cloud.userData.baseZ + Math.sin(time * 0.00012 + cloud.userData.phase) * cloud.userData.zAmp;
  }
}
