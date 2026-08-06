import test from "node:test";
import assert from "node:assert/strict";

import {
  getSkyTemperatureLayers,
  drawSkyTemperature,
  createSkyTemperatureShell,
} from "../src/universe/ink-sky-tint.mjs";

test("defines four color-temperature layers using the deep-space palette", () => {
  const layers = getSkyTemperatureLayers(611);

  assert.equal(layers.length, 4);
  const colors = layers.map((layer) => layer.color.map(String).join(","));
  assert.ok(colors.includes("13,27,42")); // 靛蓝 #0d1b2a
  assert.ok(colors.includes("26,28,46")); // 紫灰 #1a1c2e
  assert.ok(colors.includes("216,184,106")); // 暖金星云 #d8b86a
  assert.ok(colors.includes("1,3,10")); // 极暗冷场 #01030a

  for (const layer of layers) {
    assert.ok(layer.radius > 0, "every layer needs a positive radius");
    assert.ok(
      layer.alpha > 0 && layer.alpha <= 0.2,
      `alpha ${layer.alpha} must stay subtle to avoid over-exposure`,
    );
  }
});

test("is deterministic per seed but shifts across seeds", () => {
  const a = getSkyTemperatureLayers(611);
  const b = getSkyTemperatureLayers(611);
  const c = getSkyTemperatureLayers(612);

  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c); // jitter perturbs cx/cy, so at least one layer differs
});

test("draws radial gradients additively with fully transparent edges", () => {
  const calls = { gradients: 0, stops: [], fills: 0, comp: [] };
  const ctx = {
    globalCompositeOperation: "source-over",
    clearRect() {},
    createRadialGradient() {
      calls.gradients += 1;
      return { addColorStop(offset, color) { calls.stops.push({ offset, color }); } };
    },
    fillRect() { calls.fills += 1; },
  };
  Object.defineProperty(ctx, "globalCompositeOperation", {
    get() { return calls.comp[calls.comp.length - 1]; },
    set(value) { calls.comp.push(value); },
  });

  drawSkyTemperature(ctx, 1024, 1024, 611);

  assert.equal(calls.gradients, 4);
  assert.equal(calls.fills, 4);
  assert.ok(calls.comp.includes("lighter"), "gradients should blend additively");
  for (const stop of calls.stops) {
    if (stop.offset === 1) assert.match(stop.color, /rgba\(\d+, \d+, \d+, 0\)/);
  }
});

test("builds a back-side additive tint shell inside the panorama radius", () => {
  const THREE = {
    SRGBColorSpace: "srgb",
    AdditiveBlending: "additive",
    BackSide: "back",
    Mesh: class {
      constructor(geometry, material) { this.geometry = geometry; this.material = material; this.name = ""; }
    },
    SphereGeometry: class { constructor(radius) { this.radius = radius; } },
    MeshBasicMaterial: class { constructor(opts) { Object.assign(this, opts); } },
    CanvasTexture: class {},
  };
  const textures = [];
  const canvasTexture = (T, w, h, paint) => {
    const ctx = { clearRect() {}, createRadialGradient() { return { addColorStop() {} }; }, fillRect() {} };
    paint(ctx, w, h);
    const texture = new T.CanvasTexture();
    textures.push(texture);
    return texture;
  };

  const shell = createSkyTemperatureShell(THREE, { radius: 24.8, seed: 611, canvasTexture });

  assert.equal(shell.name, "InkSkyTintShell");
  assert.equal(shell.material.side, "back");
  assert.equal(shell.material.blending, "additive");
  assert.equal(shell.material.transparent, true);
  assert.equal(shell.material.depthWrite, false);
  assert.equal(textures.length, 1);
});
