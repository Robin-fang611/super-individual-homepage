import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createInkUniverseWorld, getInkWorldPlan } from "../src/universe/ink-world.mjs";
import { QUALITY_PROFILES } from "../src/universe/quality-profiles.mjs";

test("keeps every quality tier in the same ink universe while scaling visual density", () => {
  const performance = getInkWorldPlan(QUALITY_PROFILES.performance);
  const cinematic = getInkWorldPlan(QUALITY_PROFILES.cinematic);

  assert.equal(performance.radius, cinematic.radius);
  assert.equal(performance.seed, cinematic.seed);
  assert.equal(performance.inkClouds < cinematic.inkClouds, true);
  assert.equal(performance.silverGlints < cinematic.silverGlints, true);
  assert.equal(performance.silverGlints <= 72, true);
  assert.equal(cinematic.silverGlints <= 72, true);
});

test("uses ink masses and restrained glints instead of a particle-heavy sky", () => {
  const plan = getInkWorldPlan(QUALITY_PROFILES.high);

  assert.equal(plan.inkClouds > plan.silverGlints / 4, true);
  assert.equal(plan.riverStrands, 13);
  assert.equal(plan.vortexRings, 7);
});

test("keeps a substantial ink river and vortex in every quality tier", async () => {
  for (const profile of Object.values(QUALITY_PROFILES)) {
    const plan = getInkWorldPlan(profile);
    assert.equal(plan.riverStrands, 13);
    assert.equal(plan.vortexRings, 7);
    assert.ok(plan.inkClouds >= 8);
  }

  const source = await readFile(new URL("../src/universe/ink-world.mjs", import.meta.url), "utf8");
  assert.match(source, /TubeGeometry/);
  assert.match(source, /InkRiverRibbon/);
});

test("uses the panorama sky shell instead of a procedural canvas sky", async () => {
  const source = await readFile(new URL("../src/universe/ink-world.mjs", import.meta.url), "utf8");

  assert.match(source, /loadInkPanorama/);
  assert.doesNotMatch(source, /makeSkyTexture/);
});

test("releases an already loaded panorama when world construction fails", async () => {
  const failure = new Error("sphere construction failed");
  let panoramaDisposals = 0;
  const panorama = { dispose: () => { panoramaDisposals += 1; } };
  const THREE = {
    SRGBColorSpace: "srgb",
    LinearMipmapLinearFilter: "mipmap",
    LinearFilter: "linear",
    RepeatWrapping: "repeat",
    TextureLoader: class {
      load(url, onLoad) { onLoad(panorama); }
    },
    Group: class {},
    SphereGeometry: class {
      constructor() { throw failure; }
    },
  };

  await assert.rejects(
    createInkUniverseWorld({ THREE, profile: QUALITY_PROFILES.balanced }),
    failure,
  );
  assert.equal(panoramaDisposals, 1);
});
