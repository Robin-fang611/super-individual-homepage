import test from "node:test";
import assert from "node:assert/strict";

import {
  applyTrackpadMovement,
  clampDepth,
  clampPan,
  createBackgroundStars,
  createRecordNodes,
  getDepthScale,
  getParallaxOffset,
  hitTestNode,
} from "../src/universe-layout.mjs";

const records = [
  { id: "new", title: "New", date: "2026-01-01", importance: 0.9 },
  { id: "mid", title: "Mid", date: "2025-01-01", importance: 0.6 },
  { id: "old", title: "Old", date: "2024-01-01", importance: 0.4 },
];

test("creates deterministic dense background stars", () => {
  const first = createBackgroundStars({ count: 6, seed: 7, width: 1200, height: 800 });
  const second = createBackgroundStars({ count: 6, seed: 7, width: 1200, height: 800 });

  assert.deepEqual(first, second);
  assert.equal(first.length, 6);
  assert.ok(first.every((star) => star.x >= -600 && star.x <= 600));
  assert.ok(first.every((star) => star.y >= -400 && star.y <= 400));
});

test("places newer records closer to the foreground side of the main river", () => {
  const nodes = createRecordNodes(records, { width: 2400, height: 1400 });
  const newer = nodes.find((node) => node.id === "new");
  const older = nodes.find((node) => node.id === "old");

  assert.ok(newer.x > older.x);
  assert.ok(newer.radius > older.radius);
  assert.ok(newer.revealRadius > newer.radius);
});

test("keeps at least one record node discoverable in the initial viewport", () => {
  const nodes = createRecordNodes(records, { width: 2800, height: 1700 });

  assert.ok(nodes.some((node) => Math.abs(node.x) <= 520 && Math.abs(node.y) <= 390));
});

test("calculates layer-specific parallax offsets", () => {
  const pan = { x: 120, y: -80 };

  assert.deepEqual(getParallaxOffset(pan, 0.25), { x: -30, y: 20 });
  assert.deepEqual(getParallaxOffset(pan, 1.15), { x: -138, y: 92 });
});

test("clamps pan with a non-empty exploration range", () => {
  const clamped = clampPan(
    { x: 9999, y: -9999 },
    { width: 2400, height: 1400 },
    { width: 1200, height: 800 },
  );

  assert.ok(clamped.x <= 720);
  assert.ok(clamped.y >= -420);
});

test("converts two-axis trackpad scrolling into free map movement", () => {
  const camera = applyTrackpadMovement(
    { pan: { x: 0, y: 0 }, depth: 1 },
    { deltaX: 120, deltaY: -80, ctrlKey: false },
    { width: 2400, height: 1400 },
    { width: 1200, height: 800 },
  );

  assert.notEqual(camera.pan.x, 0);
  assert.notEqual(camera.pan.y, 0);
  assert.equal(camera.depth, 1);
});

test("treats pinch-style trackpad input as forward and backward depth movement", () => {
  const forward = applyTrackpadMovement(
    { pan: { x: 20, y: -10 }, depth: 1 },
    { deltaX: 0, deltaY: -120, ctrlKey: true },
    { width: 2400, height: 1400 },
    { width: 1200, height: 800 },
  );
  const backward = applyTrackpadMovement(
    { pan: { x: 20, y: -10 }, depth: 1 },
    { deltaX: 0, deltaY: 120, ctrlKey: true },
    { width: 2400, height: 1400 },
    { width: 1200, height: 800 },
  );

  assert.ok(forward.depth > 1);
  assert.ok(backward.depth < 1);
  assert.deepEqual(forward.pan, { x: 20, y: -10 });
});

test("clamps camera depth to a usable forward and backward range", () => {
  assert.equal(clampDepth(10), 1.8);
  assert.equal(clampDepth(0.1), 0.58);
  assert.equal(getDepthScale(1.25), 1.25);
});

test("hit tests only inside a discoverable record node", () => {
  const node = { id: "node", screenX: 100, screenY: 80, revealRadius: 42 };

  assert.equal(hitTestNode([node], { x: 110, y: 90 })?.id, "node");
  assert.equal(hitTestNode([node], { x: 200, y: 180 }), null);
});
