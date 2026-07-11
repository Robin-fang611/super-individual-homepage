import test from "node:test";
import assert from "node:assert/strict";

import {
  applyOrbitInput,
  getNaturalBackdropSize,
  getTrackpadOrbitDelta,
} from "../src/star-field.mjs";

test("converts trackpad two-axis scrolling into orbit movement", () => {
  const delta = getTrackpadOrbitDelta({ deltaX: 120, deltaY: -80, ctrlKey: false });

  assert.ok(delta.yaw > 0);
  assert.ok(delta.pitch < 0);
  assert.equal(delta.distance, 0);
});

test("treats pinch-style wheel input as distance instead of orbit", () => {
  const delta = getTrackpadOrbitDelta({ deltaX: 0, deltaY: -45, ctrlKey: true });

  assert.equal(delta.yaw, 0);
  assert.equal(delta.pitch, 0);
  assert.ok(delta.distance < 0);
});

test("lets vertical orbit pass beyond a full turn instead of clamping to a small arc", () => {
  const cameraState = {
    baseYaw: 0,
    targetYaw: 0,
    targetPitch: 0,
    targetDistance: 6,
  };

  applyOrbitInput(cameraState, { yaw: 0, pitch: Math.PI * 2.2, distance: 0 });

  assert.ok(cameraState.targetPitch > Math.PI * 2);
});

test("uses a wide non-mirrored backdrop for natural panorama extension", () => {
  assert.deepEqual(getNaturalBackdropSize({ width: 1024, height: 512 }), {
    width: 3072,
    height: 512,
  });
});

test("uses a cylindrical backdrop to avoid pole pinching", async () => {
  const module = await import(`../src/star-field.mjs?surface-profile=${Date.now()}`);
  const profile = module.getBackdropSurfaceProfile?.();

  assert.equal(profile?.shape, "cylinder");
  assert.equal(profile?.hasPoleConvergence, false);
});

test("uses broken ink strands instead of broad solid road ribbons", async () => {
  const module = await import(`../src/star-field.mjs?road-profile=${Date.now()}`);
  const profile = module.getStarRoadVisualProfile?.();

  assert.equal(profile?.broadRibbonLayers, 0);
  assert.equal(profile?.continuousPathLine, false);
});

test("uses a strong current-star hero profile for first-screen impact", async () => {
  const module = await import(`../src/star-field.mjs?hero-profile=${Date.now()}`);
  const profile = module.getStrongHeroVisualProfile?.();

  assert.ok(profile);
  assert.ok(profile.currentStar.coreScaleMultiplier >= 4.2);
  assert.ok(profile.currentStar.haloScale >= 0.72);
  assert.ok(profile.currentStar.haloOpacity >= 0.18);
  assert.ok(profile.currentStar.orbitRingOpacity >= 0.16);
});

test("uses layered star-river particles for a readable road direction", async () => {
  const module = await import(`../src/star-field.mjs?river-profile=${Date.now()}`);
  const profile = module.getStrongHeroVisualProfile?.();

  assert.ok(profile.starRiver.foreground.count >= 140);
  assert.ok(profile.starRiver.mid.count >= 420);
  assert.ok(profile.starRiver.background.count >= 520);
  assert.ok(profile.starRiver.foreground.opacity > profile.starRiver.background.opacity);
});

test("keeps the background behind the title instead of competing with it", async () => {
  const module = await import(`../src/star-field.mjs?backdrop-balance=${Date.now()}`);
  const profile = module.getStrongHeroVisualProfile?.();

  assert.ok(profile.backdrop.sourceImageAlpha <= 0.52);
  assert.ok(profile.backdrop.leftTitleMaskOpacity >= 0.42);
  assert.ok(profile.backdrop.centerGlowOpacity >= 0.16);
});
