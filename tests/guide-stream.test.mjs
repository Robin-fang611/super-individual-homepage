import test from "node:test";
import assert from "node:assert/strict";

import { nextUnvisitedTarget } from "../src/universe/guide-stream.mjs";

const ORDERED = ["origin", "past", "current"];

test("returns first unvisited non-current star in order", () => {
  const visited = new Set(["current"]);
  assert.equal(nextUnvisitedTarget(ORDERED, visited, "current"), "origin");
});

test("skips visited stars to find next unvisited", () => {
  const visited = new Set(["current", "origin"]);
  assert.equal(nextUnvisitedTarget(ORDERED, visited, "current"), "past");
});

test("returns null when all stars visited", () => {
  const visited = new Set(["current", "origin", "past"]);
  assert.equal(nextUnvisitedTarget(ORDERED, visited, "current"), null);
});

test("never returns the current star itself", () => {
  const visited = new Set();
  const result = nextUnvisitedTarget(ORDERED, visited, "current");
  assert.notEqual(result, "current");
});

test("treats unvisited current as not eligible", () => {
  // current 星永远不作为引导目标
  const visited = new Set();
  assert.equal(nextUnvisitedTarget(ORDERED, visited, "current"), "origin");
});
