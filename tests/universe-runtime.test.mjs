import test from "node:test";
import assert from "node:assert/strict";

import { createUniverseRuntime } from "../src/universe/runtime.mjs";

test("natural intro completion enters handoff without user input", () => {
  const harness = createRuntimeHarness();

  try {
    harness.runtime.start();
    harness.runFrame(100);

    assert.equal(harness.runtime.getSnapshot().mode, "handoff");
  } finally {
    harness.restore();
  }
});

test("user input enters the same handoff state", () => {
  const harness = createRuntimeHarness();

  try {
    harness.runtime.start();
    harness.runtime.requestHandoff();

    assert.equal(harness.runtime.getSnapshot().mode, "handoff");
  } finally {
    harness.restore();
  }
});

test("reduced motion enters handoff when the runtime starts", () => {
  const harness = createRuntimeHarness({ reducedMotion: true });

  try {
    harness.runtime.start();

    assert.equal(harness.runtime.getSnapshot().mode, "handoff");
  } finally {
    harness.restore();
  }
});

test("handoff reaches active after its configured duration", () => {
  const harness = createRuntimeHarness();

  try {
    harness.runtime.start();
    harness.runtime.requestHandoff();
    harness.runFrame(100);
    harness.runFrame(200);
    harness.runFrame(300);

    assert.equal(harness.runtime.getSnapshot().mode, "active");
  } finally {
    harness.restore();
  }
});

function createRuntimeHarness({ reducedMotion = false } = {}) {
  let clock = 0;
  const frames = installFakeAnimationFrames();
  const inputRouter = {
    activate() {},
    deactivate() {},
    destroy() {},
    consume() {
      return { lookX: 0, lookY: 0, thrust: 0, moveRight: 0, moveForward: 0, moveUp: 0 };
    },
  };
  const runtime = createUniverseRuntime({
    THREE: createFakeThree(),
    canvas: {},
    camera: { position: createVector(), quaternion: createQuaternion() },
    scene: createGroup(),
    renderer: { render() {} },
    inputRouter,
    introDurationMs: 100,
    handoffDurationMs: 300,
    now: () => clock,
    matchMedia: () => ({ matches: reducedMotion }),
  });

  return {
    runtime,
    runFrame(timestamp) {
      clock = timestamp;
      frames.runNext(timestamp);
    },
    restore() {
      runtime.destroy();
      frames.restore();
    },
  };
}

function installFakeAnimationFrames() {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  const callbacks = [];
  globalThis.requestAnimationFrame = (callback) => {
    callbacks.push(callback);
    return callbacks.length;
  };
  globalThis.cancelAnimationFrame = () => {};

  return {
    runNext(timestamp) {
      const callback = callbacks.shift();
      assert.ok(callback, "expected a queued animation frame");
      callback(timestamp);
    },
    restore() {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    },
  };
}

function createFakeThree() {
  return { Group: createGroup };
}

function createGroup() {
  return {
    children: [],
    position: createVector(),
    quaternion: createQuaternion(),
    add(child) {
      this.children.push(child);
    },
    remove(child) {
      this.children = this.children.filter((entry) => entry !== child);
    },
  };
}

function createVector() {
  return {
    x: 0,
    y: 0,
    z: 0,
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    },
    toArray() {
      return [this.x, this.y, this.z];
    },
  };
}

function createQuaternion() {
  return {
    x: 0,
    y: 0,
    z: 0,
    w: 1,
    set(x, y, z, w) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.w = w;
    },
    toArray() {
      return [this.x, this.y, this.z, this.w];
    },
  };
}
