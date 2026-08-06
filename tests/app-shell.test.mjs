import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("exploration shell contains core exploration elements", () => {
  const html = readFileSync("index.html", "utf8");

  assert.match(html, /id="intro-screen"/);
  assert.match(html, /id="universe-canvas"/);
  assert.match(html, /id="reading-overlay"/);
  assert.match(html, /id="star-compass"/);
  assert.doesNotMatch(html, /interaction-hint/);
});

test("includes a static ink fallback for unavailable WebGL", () => {
  const html = readFileSync("index.html", "utf8");
  const app = readFileSync("src/app.mjs", "utf8");
  const styles = readFileSync("styles.css", "utf8");

  assert.match(html, /id="universe-fallback"/);
  assert.match(app, /showFallback/);
  assert.match(app, /onError:/);
  assert.match(styles, /\.universe-fallback\[hidden\]\s*\{\s*display:\s*none/);
});
