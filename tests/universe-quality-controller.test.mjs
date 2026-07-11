import test from "node:test";
import assert from "node:assert/strict";

import { createQualityController } from "../src/universe/quality-controller.mjs";

test("uses a saved manual tier before automatic capability selection", () => {
  const storage = createStorage({ "ink-universe-quality": "high" });
  const controller = createQualityController({
    storage,
    capabilities: { webgl2: false, floatTextures: false, deviceMemory: 2, hardwareConcurrency: 2 },
  });

  assert.equal(controller.snapshot().profile.name, "high");
  assert.equal(controller.snapshot().source, "manual");
  assert.equal(controller.snapshot().profile.inkMode, "slices");
});

test("selects a conservative profile for constrained hardware and persists manual choices", () => {
  const storage = createStorage();
  const controller = createQualityController({
    storage,
    capabilities: { webgl2: false, floatTextures: false, deviceMemory: 2, hardwareConcurrency: 2 },
  });

  assert.equal(controller.snapshot().profile.name, "performance");
  assert.equal(controller.setManual("cinematic").profile.name, "cinematic");
  assert.equal(storage.getItem("ink-universe-quality"), "cinematic");
});

test("automatically steps down one tier after sustained poor frame pacing but never overrides manual choice", () => {
  const automatic = createQualityController({
    capabilities: { webgl2: true, floatTextures: true, deviceMemory: 8, hardwareConcurrency: 8 },
    initialQuality: "high",
  });

  const downgraded = automatic.observe({ count: 120, p95: 44, dropRate: 0.32, consecutiveOver33: 4 });
  assert.equal(downgraded.profile.name, "balanced");
  assert.equal(downgraded.source, "adaptive");

  const manual = createQualityController({
    capabilities: { webgl2: true, floatTextures: true, deviceMemory: 8, hardwareConcurrency: 8 },
    initialQuality: "high",
  });
  manual.setManual("high");
  assert.equal(manual.observe({ count: 120, p95: 44, dropRate: 0.32, consecutiveOver33: 4 }).profile.name, "high");
});

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}
