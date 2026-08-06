import test from "node:test";
import assert from "node:assert/strict";
import { buildIntroFlightPath } from "../src/universe/intro-flight-path.mjs";

const STARS = [
  { id: "origin", position: { x: 2.2, y: 0.4, z: 1.5 } },
  { id: "past", position: { x: -1.2, y: -0.3, z: -2.6 } },
  { id: "current", position: { x: 0.4, y: 0.8, z: 3.4 }, current: true },
];

const START = { x: -0.2, y: 0.8, z: 5.4 };

test("path starts at the provided start position", () => {
  const path = buildIntroFlightPath({ start: START, stars: STARS, boundaryRadius: 24 });
  const sample = path.pointAt(0);
  assert.deepEqual(sample.position, START);
  assert.ok(sample.lookAt);
  assert.ok(sample.quaternion);
});

test("path ends near the current star front", () => {
  const path = buildIntroFlightPath({ start: START, stars: STARS, boundaryRadius: 24 });
  const sample = path.pointAt(1);
  const current = STARS.find((star) => star.current);
  const distance = Math.hypot(
    sample.position.x - (current.position.x - 0.18),
    sample.position.y - (current.position.y - 0.02),
    sample.position.z - (current.position.z - 0.35),
  );
  assert.ok(distance < 0.01, `expected to settle at current star front, got distance ${distance}`);
});

test("all path points stay within the flight boundary", () => {
  const path = buildIntroFlightPath({ start: START, stars: STARS, boundaryRadius: 24 });
  for (let step = 0; step <= 20; step += 1) {
    const { position } = path.pointAt(step / 20);
    const radius = Math.hypot(position.x, position.y, position.z);
    assert.ok(radius <= 24.001, `point at ${step / 20} exceeded boundary: ${radius}`);
  }
});

test("lookAt stays finite and points at a star", () => {
  const path = buildIntroFlightPath({ start: START, stars: STARS, boundaryRadius: 24 });
  for (let step = 0; step <= 10; step += 1) {
    const { lookAt, quaternion } = path.pointAt(step / 10);
    assert.ok(Number.isFinite(lookAt.x) && Number.isFinite(lookAt.y) && Number.isFinite(lookAt.z));
    assert.ok(Number.isFinite(quaternion.x) && Number.isFinite(quaternion.w));
  }
});

test("duration is a finite positive number", () => {
  const path = buildIntroFlightPath({ start: START, stars: STARS, boundaryRadius: 24 });
  assert.ok(Number.isFinite(path.durationMs) && path.durationMs > 0);
});
