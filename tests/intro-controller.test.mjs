import test from "node:test";
import assert from "node:assert/strict";

import { createIntroController, getIntroPhase } from "../src/intro-controller.mjs";

test("maps intro elapsed time to readable phases", () => {
  assert.equal(getIntroPhase(0), "black");
  assert.equal(getIntroPhase(900), "message");
  assert.equal(getIntroPhase(2400), "collapse");
  assert.equal(getIntroPhase(3600), "reveal");
  assert.equal(getIntroPhase(4600), "done");
});

test("advances to done with its default animation frame clock", () => {
  const frames = installFakeAnimationFrames();
  const introElement = createElement();
  const appElement = createElement();
  let completions = 0;

  try {
    createIntroController({
      introElement,
      appElement,
      onDone: () => {
        completions += 1;
      },
    });

    assert.equal(introElement.dataset.phase, "black");
    assert.equal(frames.pending(), 1);

    frames.runNext(performance.now() + 4300);
    assert.equal(introElement.dataset.phase, "done");
    assert.equal(completions, 1);
    assert.equal(frames.pending(), 0);
  } finally {
    frames.restore();
  }
});

test("autoPlay false advances only when the runtime sets elapsed time", () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  let animationFrames = 0;
  globalThis.requestAnimationFrame = () => {
    animationFrames += 1;
  };

  const introElement = createElement();
  const appElement = createElement();
  let completions = 0;

  try {
    const controller = createIntroController({
      introElement,
      appElement,
      onDone: () => {
        completions += 1;
      },
      autoPlay: false,
    });

    assert.equal(introElement.dataset.phase, "black");
    assert.equal(animationFrames, 0);
    controller.setElapsed(2400);
    assert.equal(introElement.dataset.phase, "collapse");
    assert.equal(appElement.dataset.introPhase, "collapse");

    controller.setElapsed(4300);
    controller.setElapsed(4600);
    assert.equal(introElement.dataset.phase, "done");
    assert.equal(introElement.attributes.get("aria-hidden"), "true");
    assert.equal(completions, 1);
    assert.equal(animationFrames, 0);
  } finally {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  }
});

test("setElapsed takes ownership from an already scheduled animation frame", () => {
  const frames = installFakeAnimationFrames();
  const introElement = createElement();
  const appElement = createElement();

  try {
    const controller = createIntroController({ introElement, appElement });
    assert.equal(frames.pending(), 1);

    controller.setElapsed(2400);
    assert.equal(introElement.dataset.phase, "collapse");

    frames.runNext(performance.now() + 900);
    assert.equal(introElement.dataset.phase, "collapse");
    assert.equal(frames.pending(), 0);
  } finally {
    frames.restore();
  }
});

test("skip uses the same one-time completion path as elapsed time", () => {
  const introElement = createElement();
  const appElement = createElement();
  let completions = 0;
  const controller = createIntroController({
    introElement,
    appElement,
    autoPlay: false,
    onDone: () => {
      completions += 1;
    },
  });

  controller.skip();
  controller.setElapsed(4300);

  assert.equal(introElement.dataset.phase, "done");
  assert.equal(completions, 1);
});

function createElement() {
  return {
    dataset: {},
    attributes: new Map(),
    setAttribute(name, value) {
      this.attributes.set(name, value);
    },
  };
}

function installFakeAnimationFrames() {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const callbacks = [];
  globalThis.requestAnimationFrame = (callback) => {
    callbacks.push(callback);
    return callbacks.length;
  };

  return {
    pending() {
      return callbacks.length;
    },
    runNext(now) {
      callbacks.shift()?.(now);
    },
    restore() {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    },
  };
}
