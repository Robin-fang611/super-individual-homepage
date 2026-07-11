import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("builds the visual scene from the ink world and adaptive quality controller", async () => {
  const source = await readFile(new URL("../src/star-field.mjs", import.meta.url), "utf8");

  assert.match(source, /createInkUniverseWorld/);
  assert.match(source, /createQualityController/);
  assert.match(source, /createFrameMonitor/);
  assert.doesNotMatch(source, /createStarRiver/);
  assert.doesNotMatch(source, /camera\.lookAt\(focus\)/);
});
