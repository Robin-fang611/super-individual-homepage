import test from "node:test";
import assert from "node:assert/strict";

import { captureCameraView, restoreCameraView } from "../src/camera-view-state.mjs";

test("restores the exact pre-reading camera target and active node", () => {
  const state = {
    targetFocus: { x: 1, y: 2, z: 3 },
    targetDistance: 6,
    baseYaw: 0.2,
    targetPitch: 0.1,
  };
  const snapshot = captureCameraView(state, "before-reading");
  state.targetFocus = { x: 8, y: 8, z: 8 };
  state.targetDistance = 4;
  const activeStarId = restoreCameraView(state, snapshot);

  assert.deepEqual(state.targetFocus, { x: 1, y: 2, z: 3 });
  assert.equal(state.targetDistance, 6);
  assert.equal(activeStarId, "before-reading");
});

test("captures focus coordinates by value", () => {
  const state = {
    targetFocus: { x: 1, y: 2, z: 3 },
    targetDistance: 6,
    baseYaw: 0.2,
    targetPitch: 0.1,
  };

  const snapshot = captureCameraView(state, null);
  state.targetFocus.x = 9;

  assert.deepEqual(snapshot.targetFocus, { x: 1, y: 2, z: 3 });
});
