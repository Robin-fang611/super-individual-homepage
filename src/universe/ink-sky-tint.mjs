// Level 1 · 背景天穹色温分层
//
// 在现有全景天穹（PNG panorama，由 ink-panorama.mjs 加载）之上叠加一层
// 低透明、多中心的径向渐变，引入靛蓝 / 紫灰气韵与右上暖色星云 patch，
// 强化深空"色彩呼吸"。
//
// 设计约束（来自 DESIGN-ENHANCE-PLAN Level 1）：
// - 不新增依赖、不改动 Three.js 版本、不重写渲染管线；
// - 不替换全景天穹，仅作叠加层（additive shell）；
// - 不改动 ice-blue / gold token 的语义，色温层用更深的氛围色。

// 深空气韵调色板：靛蓝 / 紫灰 / 暖金星云 / 极暗冷场（暗角带一点冷蓝而非纯黑）。
const TINT_PALETTE = Object.freeze([
  // 左下冷蓝气韵
  { cx: 0.20, cy: 0.74, radius: 0.62, color: [13, 27, 42], alpha: 0.16 }, // #0d1b2a 靛蓝
  // 中部紫灰气韵
  { cx: 0.50, cy: 0.50, radius: 0.82, color: [26, 28, 46], alpha: 0.10 }, // #1a1c2e 紫灰
  // 右上暖色星云 patch
  { cx: 0.82, cy: 0.18, radius: 0.34, color: [216, 184, 106], alpha: 0.08 }, // #d8b86a 暖金
  // 左上极暗冷场（暗角边缘冷蓝而非纯黑）
  { cx: 0.12, cy: 0.16, radius: 0.50, color: [1, 3, 10], alpha: 0.12 }, // #01030a
]);

// 轻量确定性扰动：让不同世界（seed）的天穹色温分布略有差异，但同一 seed 稳定可测。
function makeJitter(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function getSkyTemperatureLayers(seed = 0) {
  const jitter = makeJitter(seed);
  return TINT_PALETTE.map((layer) => ({
    ...layer,
    cx: layer.cx + (jitter() - 0.5) * 0.04,
    cy: layer.cy + (jitter() - 0.5) * 0.04,
  }));
}

// 在提供的 2D 上下文上绘制色温层。context 可为真实 CanvasRenderingContext2D，
// 也可为测试用的轻量 mock。所有绘制都收敛到透明边缘，保证叠加不过曝。
export function drawSkyTemperature(context, width, height, seed = 0) {
  context.clearRect(0, 0, width, height);
  const prev = context.globalCompositeOperation;
  context.globalCompositeOperation = "lighter"; // 叠加式混合，让气韵自然交融
  const maxExtent = Math.max(width, height) * 0.5;
  for (const layer of getSkyTemperatureLayers(seed)) {
    const x = layer.cx * width;
    const y = layer.cy * height;
    const r = layer.radius * maxExtent;
    const [cr, cg, cb] = layer.color;
    const gradient = context.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${layer.alpha})`);
    gradient.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }
  context.globalCompositeOperation = prev;
}

// 构建色温叠加壳：略小于全景天穹半径的内层球，additive 混合、低透明、不写深度。
// canvasTexture 由调用方注入（ink-world.mjs 的本地 helper），便于在 node 中测试。
export function createSkyTemperatureShell(THREE, { radius, seed = 0, canvasTexture }) {
  const size = 1024;
  const texture = canvasTexture(THREE, size, size, (ctx, w, h) => drawSkyTemperature(ctx, w, h, seed));
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 48),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    }),
  );
  shell.name = "InkSkyTintShell";
  return shell;
}
