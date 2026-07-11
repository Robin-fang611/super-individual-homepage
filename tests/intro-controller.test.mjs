import test from "node:test";
import assert from "node:assert/strict";

import { getIntroPhase } from "../src/intro-controller.mjs";

test("maps intro elapsed time to readable phases", () => {
  assert.equal(getIntroPhase(0), "black");
  assert.equal(getIntroPhase(900), "message");
  assert.equal(getIntroPhase(2400), "collapse");
  assert.equal(getIntroPhase(3600), "reveal");
  assert.equal(getIntroPhase(4600), "done");
});
