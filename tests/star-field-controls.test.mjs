import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createStarField } from "../src/star-field.mjs";

test("builds the visual scene from the ink world and adaptive quality controller", async () => {
  const source = await readFile(new URL("../src/star-field.mjs", import.meta.url), "utf8");

  assert.match(source, /createInkUniverseWorld/);
  assert.match(source, /createQualityController/);
  assert.match(source, /createFrameMonitor/);
  assert.doesNotMatch(source, /createStarRiver/);
  assert.doesNotMatch(source, /camera\.lookAt\(focus\)/);
});

test("releases the renderer and rethrows when panorama world creation fails", async (context) => {
  const originalWindow = globalThis.window;
  context.after(() => {
    globalThis.window = originalWindow;
  });
  globalThis.window = { devicePixelRatio: 1 };

  let disposeCalls = 0;
  const failure = new Error("panorama unavailable");
  const THREE = {
    SRGBColorSpace: "srgb",
    WebGLRenderer: class {
      capabilities = { isWebGL2: true, maxTextureSize: 4096 };
      setClearColor() {}
      setPixelRatio() {}
      dispose() { disposeCalls += 1; }
    },
    Scene: class {},
    FogExp2: class {},
    PerspectiveCamera: class {},
  };

  await assert.rejects(
    createStarField({
      canvas: {},
      loadThreeModule: async () => THREE,
      createWorld: async () => { throw failure; },
    }),
    failure,
  );
  assert.equal(disposeCalls, 1);
});
