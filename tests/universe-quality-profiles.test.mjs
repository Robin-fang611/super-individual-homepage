import test from "node:test";
import assert from "node:assert/strict";

import { constrainProfile } from "../src/universe/capability-guard.mjs";
import { QUALITY_ORDER, QUALITY_PROFILES } from "../src/universe/quality-profiles.mjs";

test("defines four immutable quality tiers sharing one world seed", () => {
  assert.deepEqual(QUALITY_ORDER, ["performance", "balanced", "high", "cinematic"]);

  for (const name of QUALITY_ORDER) {
    assert.ok(Object.isFrozen(QUALITY_PROFILES[name]));
    assert.equal(QUALITY_PROFILES[name].worldSeed, 611);
  }

  assert.ok(QUALITY_PROFILES.performance.dprMax < QUALITY_PROFILES.cinematic.dprMax);
  assert.ok(QUALITY_PROFILES.performance.inkSteps < QUALITY_PROFILES.cinematic.inkSteps);
});

test("capability guard removes unsupported expensive effects without changing the world", () => {
  const constrained = constrainProfile(QUALITY_PROFILES.cinematic, {
    webgl2: false,
    floatTextures: false,
    maxTextureSize: 2048,
  });

  assert.equal(constrained.worldSeed, 611);
  assert.equal(constrained.inkMode, "slices");
  assert.equal(constrained.inkSteps, 0);
  assert.equal(constrained.dprMax, 1.25);
  assert.ok(Object.isFrozen(constrained));
});
