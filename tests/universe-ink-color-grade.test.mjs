import test from "node:test";
import assert from "node:assert/strict";

import { INK_COLOR_GRADE } from "../src/universe/ink-color-grade.mjs";

test("uses the original star-road navy, teal, moonlit silver, and restrained gold grade", () => {
  assert.equal(INK_COLOR_GRADE.skyTint, 0x82b8a8);
  assert.equal(INK_COLOR_GRADE.inkMistPrimary, "#17484c");
  assert.equal(INK_COLOR_GRADE.inkMistDeep, "#0a2f35");
  assert.equal(INK_COLOR_GRADE.inkMistBright, "#2a6e6b");
  assert.equal(INK_COLOR_GRADE.riverSilver, 0xcbe8df);
  assert.equal(INK_COLOR_GRADE.goldGlint, 0xd7bd78);
});
