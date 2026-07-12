import test from "node:test";
import assert from "node:assert/strict";

import {
  getInkPanoramaAsset,
  loadInkPanorama,
} from "../src/universe/ink-panorama.mjs";

test("quality tiers select distinct panorama assets with bounded decode sizes", () => {
  const performance = getInkPanoramaAsset({ name: "performance", worldSeed: 611 });
  const balanced = getInkPanoramaAsset({ name: "balanced", worldSeed: 611 });
  const high = getInkPanoramaAsset({ name: "high", worldSeed: 611 });
  const cinematic = getInkPanoramaAsset({ name: "cinematic", worldSeed: 611 });

  assert.notEqual(performance.url, balanced.url);
  assert.notEqual(balanced.url, high.url);
  assert.notEqual(high.url, cinematic.url);
  assert.equal(performance.worldSeed, cinematic.worldSeed);
  assert.deepEqual(
    [performance.resolution, balanced.resolution, high.resolution, cinematic.resolution],
    [1024, 1536, 2048, 3072],
  );
});

test("loadInkPanorama applies texture settings to the selected tier asset", async () => {
  const requests = [];
  const texture = {};
  const THREE = {
    SRGBColorSpace: "srgb",
    LinearMipmapLinearFilter: "mipmap",
    LinearFilter: "linear",
    RepeatWrapping: "repeat",
    TextureLoader: class {
      load(url, onLoad) {
        requests.push(url);
        onLoad(texture);
      }
    },
  };

  assert.equal(await loadInkPanorama(THREE, { name: "performance", worldSeed: 611 }), texture);
  assert.deepEqual(requests, [getInkPanoramaAsset({ name: "performance", worldSeed: 611 }).url]);
  assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
  assert.equal(texture.minFilter, THREE.LinearMipmapLinearFilter);
  assert.equal(texture.magFilter, THREE.LinearFilter);
  assert.equal(texture.wrapS, THREE.RepeatWrapping);
});

test("loadInkPanorama rejects when the selected asset cannot load", async () => {
  const failure = new Error("panorama asset unavailable");
  const THREE = {
    TextureLoader: class {
      load(url, onLoad, onProgress, onError) {
        onError(failure);
      }
    },
  };

  await assert.rejects(
    loadInkPanorama(THREE, { name: "high", worldSeed: 611 }),
    failure,
  );
});
