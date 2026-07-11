import test from "node:test";
import assert from "node:assert/strict";
import { createInputRouter, normalizeWheelDelta, wheelToInput } from "../src/universe/input-router.mjs";

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

function withFakeDom(run) {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const fakeWindow = new FakeEventTarget();
  const fakeDocument = new FakeEventTarget();
  globalThis.window = fakeWindow;
  globalThis.document = fakeDocument;
  try {
    run({ fakeWindow, fakeDocument });
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
}

function inputEvent(properties = {}) {
  return {
    prevented: false,
    preventDefault() { this.prevented = true; },
    ...properties,
  };
}

test("normalizes line and page wheel deltas to pixels", () => {
  assert.deepEqual(normalizeWheelDelta({ deltaX: 2, deltaY: 3, deltaMode: 1 }, { width: 1200, height: 800 }), { x: 32, y: 48 });
  assert.deepEqual(normalizeWheelDelta({ deltaX: 1, deltaY: -1, deltaMode: 2 }, { width: 1200, height: 800 }), { x: 240, y: -240 });
});

test("maps two-finger scroll to look and ctrl-wheel pinch to thrust", () => {
  assert.deepEqual(wheelToInput({ deltaX: 12, deltaY: -8, deltaMode: 0, ctrlKey: false }, { width: 1200, height: 800 }), { lookX: 12, lookY: -8, thrust: 0 });
  assert.deepEqual(wheelToInput({ deltaX: 0, deltaY: -6, deltaMode: 0, ctrlKey: true }, { width: 1200, height: 800 }), { lookX: 0, lookY: 0, thrust: 6 });
});

test("gates wheel and keyboard input behind activation and prevents active defaults", () => {
  withFakeDom(({ fakeWindow }) => {
    const target = new FakeEventTarget();
    const emitted = [];
    const router = createInputRouter({
      target,
      getViewport: () => ({ width: 1200, height: 800 }),
      onInput: (input) => emitted.push(input),
    });
    const inactiveWheel = inputEvent({ deltaX: 4, deltaY: -3, deltaMode: 0, ctrlKey: false });

    target.dispatch("wheel", inactiveWheel);
    const inactiveKey = inputEvent({ code: "KeyW" });
    fakeWindow.dispatch("keydown", inactiveKey);
    assert.equal(inactiveWheel.prevented, false);
    assert.equal(inactiveKey.prevented, false);
    assert.equal(emitted.length, 0);
    assert.deepEqual(router.snapshot(), { lookX: 0, lookY: 0, thrust: 0, moveRight: 0, moveForward: 0, moveUp: 0 });

    router.activate();
    const activeWheel = inputEvent({ deltaX: 4, deltaY: -3, deltaMode: 0, ctrlKey: false });
    target.dispatch("wheel", activeWheel);
    assert.equal(activeWheel.prevented, true);
    assert.deepEqual(router.snapshot(), { lookX: 4, lookY: -3, thrust: 0, moveRight: 0, moveForward: 0, moveUp: 0 });
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].source, "trackpad-keyboard");
    assert.equal(emitted[0].controlActive, true);
    assert.equal(typeof emitted[0].timestamp, "number");

    router.deactivate();
    const deactivatedWheel = inputEvent({ deltaX: 8, deltaY: 9, deltaMode: 0, ctrlKey: false });
    target.dispatch("wheel", deactivatedWheel);
    assert.equal(deactivatedWheel.prevented, false);
    assert.equal(emitted.length, 1);
    assert.deepEqual(router.snapshot(), { lookX: 0, lookY: 0, thrust: 0, moveRight: 0, moveForward: 0, moveUp: 0 });
  });
});

test("tracks keyboard codes while consume clears only instantaneous input", () => {
  withFakeDom(({ fakeWindow }) => {
    const target = new FakeEventTarget();
    const router = createInputRouter({ target, getViewport: () => ({ width: 1200, height: 800 }) });
    router.activate();
    const forward = inputEvent({ code: "KeyW", key: "z" });
    const right = inputEvent({ code: "KeyD", key: "q" });

    fakeWindow.dispatch("keydown", forward);
    fakeWindow.dispatch("keydown", right);
    target.dispatch("wheel", inputEvent({ deltaX: 7, deltaY: -5, deltaMode: 0, ctrlKey: false }));
    assert.equal(forward.prevented, true);
    assert.equal(right.prevented, true);
    assert.deepEqual(router.consume(), { lookX: 7, lookY: -5, thrust: 0, moveRight: 1, moveForward: 1, moveUp: 0 });
    assert.deepEqual(router.consume(), { lookX: 0, lookY: 0, thrust: 0, moveRight: 1, moveForward: 1, moveUp: 0 });

    const forwardUp = inputEvent({ code: "KeyW" });
    fakeWindow.dispatch("keyup", forwardUp);
    assert.equal(forwardUp.prevented, true);
    assert.deepEqual(router.snapshot(), { lookX: 0, lookY: 0, thrust: 0, moveRight: 1, moveForward: 0, moveUp: 0 });
  });
});

test("clears sustained keyboard state on blur and visibility changes", () => {
  withFakeDom(({ fakeWindow, fakeDocument }) => {
    const target = new FakeEventTarget();
    const router = createInputRouter({ target, getViewport: () => ({ width: 1200, height: 800 }) });
    router.activate();

    fakeWindow.dispatch("keydown", inputEvent({ code: "KeyE" }));
    assert.equal(router.snapshot().moveUp, 1);
    fakeWindow.dispatch("blur");
    assert.deepEqual(router.snapshot(), { lookX: 0, lookY: 0, thrust: 0, moveRight: 0, moveForward: 0, moveUp: 0 });

    fakeWindow.dispatch("keydown", inputEvent({ code: "KeyS" }));
    fakeWindow.dispatch("keydown", inputEvent({ code: "KeyQ" }));
    assert.equal(router.snapshot().moveForward, -1);
    assert.equal(router.snapshot().moveUp, -1);
    fakeDocument.dispatch("visibilitychange");
    assert.deepEqual(router.snapshot(), { lookX: 0, lookY: 0, thrust: 0, moveRight: 0, moveForward: 0, moveUp: 0 });
  });
});

test("destroy removes every registered listener and clears state", () => {
  withFakeDom(({ fakeWindow, fakeDocument }) => {
    const target = new FakeEventTarget();
    const emitted = [];
    const router = createInputRouter({
      target,
      getViewport: () => ({ width: 1200, height: 800 }),
      onInput: (input) => emitted.push(input),
    });
    router.activate();
    fakeWindow.dispatch("keydown", inputEvent({ code: "KeyA" }));
    assert.equal(target.listenerCount("wheel"), 1);
    assert.equal(fakeWindow.listenerCount("keydown"), 1);
    assert.equal(fakeWindow.listenerCount("keyup"), 1);
    assert.equal(fakeWindow.listenerCount("blur"), 1);
    assert.equal(fakeDocument.listenerCount("visibilitychange"), 1);

    router.destroy();
    assert.equal(target.listenerCount("wheel"), 0);
    assert.equal(fakeWindow.listenerCount("keydown"), 0);
    assert.equal(fakeWindow.listenerCount("keyup"), 0);
    assert.equal(fakeWindow.listenerCount("blur"), 0);
    assert.equal(fakeDocument.listenerCount("visibilitychange"), 0);
    assert.deepEqual(router.snapshot(), { lookX: 0, lookY: 0, thrust: 0, moveRight: 0, moveForward: 0, moveUp: 0 });

    const wheel = inputEvent({ deltaX: 3, deltaY: 2, deltaMode: 0, ctrlKey: false });
    target.dispatch("wheel", wheel);
    fakeWindow.dispatch("keydown", inputEvent({ code: "KeyD" }));
    assert.equal(wheel.prevented, false);
    assert.equal(emitted.length, 1);
    assert.deepEqual(router.snapshot(), { lookX: 0, lookY: 0, thrust: 0, moveRight: 0, moveForward: 0, moveUp: 0 });
  });
});
