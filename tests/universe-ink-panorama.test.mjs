import test from "node:test";
import assert from "node:assert/strict";

import { getInkPanoramaAsset } from "../src/universe/ink-panorama.mjs";

test("all quality tiers resolve to the same panorama world with bounded texture sizes", () => {
  const performance = getInkPanoramaAsset({ name: "performance", worldSeed: 611 });
  const cinematic = getInkPanoramaAsset({ name: "cinematic", worldSeed: 611 });

  assert.equal(performance.url, cinematic.url);
  assert.equal(performance.worldSeed, cinematic.worldSeed);
  assert.ok(performance.resolution < cinematic.resolution);
});
