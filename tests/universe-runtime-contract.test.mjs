import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("star-field delegates camera ownership to UniverseRuntime", async () => {
  const source = await readFile(new URL("../src/star-field.mjs", import.meta.url), "utf8");

  assert.match(source, /createUniverseRuntime/);
  assert.doesNotMatch(source, /camera\.lookAt\(focus\)/);
  assert.doesNotMatch(source, /applyOrbitInput/);
});

test("app lets the runtime drive the intro and pauses during reading", async () => {
  const source = await readFile(new URL("../src/app.mjs", import.meta.url), "utf8");

  assert.match(source, /autoPlay:\s*false/);
  assert.match(source, /starField\?\.pause\?\.\(\)/);
  assert.match(source, /starField\?\.resume\?\.\(\)/);
});
