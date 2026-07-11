import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWheelDelta, wheelToInput } from "../src/universe/input-router.mjs";

test("normalizes line and page wheel deltas to pixels", () => {
  assert.deepEqual(normalizeWheelDelta({ deltaX: 2, deltaY: 3, deltaMode: 1 }, { width: 1200, height: 800 }), { x: 32, y: 48 });
  assert.deepEqual(normalizeWheelDelta({ deltaX: 1, deltaY: -1, deltaMode: 2 }, { width: 1200, height: 800 }), { x: 240, y: -240 });
});

test("maps two-finger scroll to look and ctrl-wheel pinch to thrust", () => {
  assert.deepEqual(wheelToInput({ deltaX: 12, deltaY: -8, deltaMode: 0, ctrlKey: false }, { width: 1200, height: 800 }), { lookX: 12, lookY: -8, thrust: 0 });
  assert.deepEqual(wheelToInput({ deltaX: 0, deltaY: -6, deltaMode: 0, ctrlKey: true }, { width: 1200, height: 800 }), { lookX: 0, lookY: 0, thrust: 6 });
});
