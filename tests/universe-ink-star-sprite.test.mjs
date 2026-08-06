import test from "node:test";
import assert from "node:assert/strict";

import {
  drawDiffractionSprite,
  makeStarSpriteTexture,
  createStarSprite,
} from "../src/universe/ink-star-sprite.mjs";

// 轻量 mock 2D 上下文：捕获绘制调用与合成模式，足以验证衍射绘制逻辑。
function makeCtx() {
  const calls = { radial: 0, linear: 0, fills: 0, clears: 0, stops: [], comp: [] };
  const ctx = {
    _comp: "source-over",
    clearRect() { calls.clears += 1; },
    createRadialGradient() {
      calls.radial += 1;
      return { addColorStop(offset, color) { calls.stops.push({ offset, color, kind: "radial" }); } };
    },
    createLinearGradient() {
      calls.linear += 1;
      return { addColorStop(offset, color) { calls.stops.push({ offset, color, kind: "linear" }); } };
    },
    fillRect() { calls.fills += 1; },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
  };
  Object.defineProperty(ctx, "globalCompositeOperation", {
    get() { return ctx._comp; },
    set(value) { ctx._comp = value; calls.comp.push(value); },
  });
  ctx._calls = calls;
  return ctx;
}

test("draws a soft radial core plus additive tapered rays that fade to transparent", () => {
  const ctx = makeCtx();
  drawDiffractionSprite(ctx, 128, { arms: 4, peak: 0.6 });

  // 1 个中央柔光（radial）+ 每臂 1 个线性渐变（锥状射线）。
  assert.equal(ctx._calls.radial, 1, "one radial core gradient");
  assert.equal(ctx._calls.linear, 4, "four ray gradients for arms=4");
  assert.ok(ctx._calls.fills >= 1, "core is filled via fillRect");
  assert.ok(ctx._calls.comp.includes("lighter"), "rays blend additively");

  // 所有渐变边缘必须收敛到透明，杜绝硬边纯白光斑。
  for (const stop of ctx._calls.stops) {
    if (stop.offset === 1) assert.match(stop.color, /rgba\(\d+,\s*\d+,\s*\d+,\s*0\)/);
  }

  // 射线峰值不透明度被峰值参数约束（≤0.6），保持克制。
  const armPeaks = ctx._calls.stops.filter((s) => s.kind === "linear" && s.offset === 0);
  for (const peak of armPeaks) assert.match(peak.color, /rgba\(255,\s*255,\s*255,\s*0\.5[0-9]\)/);
});

test("ray count follows the arms parameter", () => {
  const ctx = makeCtx();
  drawDiffractionSprite(ctx, 128, { arms: 6 });
  assert.equal(ctx._calls.linear, 6);
  // 默认 arms=4
  const ctx2 = makeCtx();
  drawDiffractionSprite(ctx2, 128);
  assert.equal(ctx2._calls.linear, 4);
});

test("builds a shared star sprite texture once via injected canvasTexture", () => {
  const THREE = {
    CanvasTexture: class { dispose() {} },
  };
  const textures = [];
  const canvasTexture = (T, w, h, paint) => {
    const ctx = makeCtx();
    paint(ctx, w, h);
    const texture = new T.CanvasTexture();
    textures.push(texture);
    return texture;
  };
  const texture = makeStarSpriteTexture(THREE, canvasTexture);
  assert.equal(textures.length, 1, "texture painted exactly once");
  assert.ok(texture instanceof THREE.CanvasTexture);
});

test("creates a hidden, additive star sprite tinted by the node glow color", () => {
  const THREE = {
    AdditiveBlending: "additive",
    Sprite: class {
      constructor(material) { this.material = material; this.scale = { set() {} }; this.name = ""; this.visible = true; }
    },
    SpriteMaterial: class { constructor(opts) { Object.assign(this, opts); } },
  };
  // 用真实 scale.set 校验比例
  let scaleArgs = null;
  THREE.Sprite = class {
    constructor(material) { this.material = material; this.scale = { set: (x, y, z) => { scaleArgs = [x, y, z]; } }; this.name = ""; this.visible = true; }
  };
  const fakeTexture = { isTexture: true };
  const sprite = createStarSprite(THREE, { texture: fakeTexture, color: 0xd7bd78, scale: 0.6 });

  assert.equal(sprite.name, "starSprite");
  assert.equal(sprite.visible, false, "hidden by default");
  assert.equal(sprite.material.opacity, 0, "invisible until hover");
  assert.equal(sprite.material.blending, "additive");
  assert.equal(sprite.material.map, fakeTexture);
  assert.deepEqual(scaleArgs, [0.6, 0.6, 1]);
});
