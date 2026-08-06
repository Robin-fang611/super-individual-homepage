import test from "node:test";
import assert from "node:assert/strict";
import { createExplorationHint, getHintPhase } from "../src/exploration-hint.mjs";

test("keeps the discovery hint hidden before delay and expires it once", () => {
  assert.equal(getHintPhase(0, { delayMs: 900, visibleMs: 2600 }), "hidden");
  assert.equal(getHintPhase(900, { delayMs: 900, visibleMs: 2600 }), "visible");
  assert.equal(getHintPhase(3500, { delayMs: 900, visibleMs: 2600 }), "done");
});

test("dismisses the hint after the first scheduled display", () => {
  const originalWindow = globalThis.window;
  const timers = new Map();
  let nextTimerId = 1;

  globalThis.window = {
    setTimeout(callback) {
      const timerId = nextTimerId;
      nextTimerId += 1;
      timers.set(timerId, callback);
      return timerId;
    },
    clearTimeout(timerId) {
      timers.delete(timerId);
    },
  };

  try {
    const element = {
      dataset: {},
      attributes: new Map(),
      setAttribute(name, value) {
        this.attributes.set(name, value);
      },
    };
    const hint = createExplorationHint({ element, delayMs: 900, visibleMs: 2600 });

    hint.schedule();
    hint.schedule();
    assert.equal(timers.size, 1);

    const show = timers.get(1);
    timers.delete(1);
    show();
    assert.equal(element.dataset.phase, "visible");
    assert.equal(element.attributes.get("aria-hidden"), "false");

    const hide = timers.get(2);
    timers.delete(2);
    hide();
    assert.equal(element.dataset.phase, "done");
    assert.equal(element.attributes.get("aria-hidden"), "true");
  } finally {
    globalThis.window = originalWindow;
  }
});
