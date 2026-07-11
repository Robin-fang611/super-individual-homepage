import test from "node:test";
import assert from "node:assert/strict";

import {
  createExperienceState,
  handoffWeights,
  transitionExperience,
} from "../src/universe/experience-state.mjs";

test("moves through loading, ready, intro, handoff, and active", () => {
  let state = createExperienceState();

  for (const type of ["LOADED", "INTRO_STARTED", "INTRO_FINISHED", "HANDOFF_FINISHED"]) {
    state = transitionExperience(state, { type });
  }

  assert.equal(state.mode, "active");
});

test("user input and reduced motion use the same handoff path", () => {
  const intro = { ...createExperienceState(), mode: "intro" };

  assert.equal(transitionExperience(intro, { type: "USER_INPUT" }).mode, "handoff");
  assert.equal(transitionExperience(intro, { type: "REDUCED_MOTION" }).mode, "handoff");
});

test("illegal transitions are no-ops", () => {
  const loading = createExperienceState();

  assert.equal(transitionExperience(loading, { type: "HANDOFF_FINISHED" }), loading);
});

test("handoff weights are complementary at the start, midpoint, and end", () => {
  assert.deepEqual(handoffWeights(0, 400), { autopilot: 1, player: 0 });

  const middle = handoffWeights(200, 400);
  assert.ok(Math.abs(middle.autopilot + middle.player - 1) < 1e-9);
  assert.deepEqual(middle, { autopilot: 0.5, player: 0.5 });

  assert.deepEqual(handoffWeights(400, 400), { autopilot: 0, player: 1 });
});
