// Level 3 · 星芒纹理（DESIGN-ENHANCE-PLAN Level 3）
//
// 给重要星路节点（core / key）加一个 Canvas 绘制的衍射星芒 Sprite，
// 仅在 hover/active 时显现，透明度随星体呼吸律动，让"发光点"升级为"恒星"。
//
// 设计约束（来自 DESIGN-ENHANCE-PLAN Level 3 + 本轮三智能体审议）：
// - 不新增依赖、不改动 Three.js 版本、不重写渲染管线；
// - 不替换既有 glow / ring / label，仅作为独立叠加 Sprite（同款 AdditiveBlending）；
// - 不改动 ice-blue / gold token 语义（星芒用节点自身 glow 色做材质着色；纹理为白，靠 material.color 上色）；
// - 射线必须"软"：沿轴渐变收尖、低不透明度峰值（≤0.6），杜绝硬边纯白"闪光贴纸"感；
// - 纯绘制函数 drawDiffractionSprite 仅用标准 canvas API，可在 node 中以 mock ctx 单测。

function drawDiffractionSprite(context, size, { arms = 4, peak = 0.6 } = {}) {
  const half = size / 2;
  context.clearRect(0, 0, size, size);

  // 中央柔光：收敛到透明边缘，避免纯白大光斑。
  const core = context.createRadialGradient(half, half, 0, half, half, half * 0.42);
  core.addColorStop(0, `rgba(255,255,255,${peak})`);
  core.addColorStop(0.45, `rgba(255,255,255,${peak * 0.32})`);
  core.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = core;
  context.fillRect(0, 0, size, size);

  // 衍射射线：锥形（底宽顶窄）+ 沿轴渐变，柔边收尖。
  context.save();
  context.translate(half, half);
  context.globalCompositeOperation = "lighter";
  const armLen = half * 0.96;
  const armWidth = Math.max(1.4, size * 0.011);
  const halfWidth = armWidth / 2;
  for (let index = 0; index < arms; index += 1) {
    const angle = (Math.PI * 2 * index) / arms;
    context.save();
    context.rotate(angle);
    const grad = context.createLinearGradient(0, 0, 0, -armLen);
    grad.addColorStop(0, `rgba(255,255,255,${peak * 0.85})`);
    grad.addColorStop(0.35, `rgba(255,255,255,${peak * 0.22})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = grad;
    context.beginPath();
    context.moveTo(-halfWidth, 0);
    context.lineTo(halfWidth, 0);
    context.lineTo(halfWidth * 0.15, -armLen);
    context.lineTo(-halfWidth * 0.15, -armLen);
    context.closePath();
    context.fill();
    context.restore();
  }
  context.restore();
}

// 构建一次衍射纹理（白底，靠 material.color 上色）。canvasTexture 由调用方注入，
// 便于在 node 中测试；浏览器默认路径用 document.createElement。
export function makeStarSpriteTexture(THREE, canvasTexture) {
  const paint = (context, width, height) => drawDiffractionSprite(context, width, { arms: 4, peak: 0.6 });
  if (canvasTexture) {
    return canvasTexture(THREE, 128, 128, paint);
  }
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  paint(context, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// 创建衍射星芒 Sprite：默认隐藏（opacity 0, visible false），由 beacon 的 hover 逻辑打开。
export function createStarSprite(THREE, { texture, color, scale = 0.5 }) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale, scale, 1);
  sprite.name = "starSprite";
  sprite.visible = false;
  return sprite;
}

export { drawDiffractionSprite };
