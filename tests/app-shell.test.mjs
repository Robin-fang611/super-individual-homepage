import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("exploration shell has no visible nav, labels, or years", () => {
  const html = readFileSync("index.html", "utf8");

  assert.match(html, /id="intro-screen"/);
  assert.match(html, /id="universe-canvas"/);
  assert.match(html, /id="reading-overlay"/);
  assert.doesNotMatch(html, /hidden-nav|interaction-hint|星路导航|STAR ROAD|2026/);
});

test("includes a static ink fallback for unavailable WebGL", () => {
  const html = readFileSync("index.html", "utf8");
  const app = readFileSync("src/app.mjs", "utf8");

  assert.match(html, /id="universe-fallback"/);
  assert.match(app, /showFallback/);
  assert.match(app, /onError:/);
});
