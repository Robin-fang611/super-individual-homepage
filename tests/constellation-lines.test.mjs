import test from "node:test";
import assert from "node:assert/strict";

// 用轻量 THREE stub 测试 createConstellationLines 的结构
class Group {
  constructor() { this.children = []; }
  add(child) { this.children.push(child); }
  clear() { this.children = []; }
}
class BufferGeometry {
  constructor() { this.attributes = {}; }
  setAttribute(name, attr) { this.attributes[name] = attr; }
  dispose() {}
}
class BufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; }
}
class LineBasicMaterial {
  constructor(opts) { this.opts = opts; }
  dispose() {}
}
class LineSegments {
  constructor(geometry, material) { this.geometry = geometry; this.material = material; }
}
const THREE = { Group, BufferGeometry, BufferAttribute, LineBasicMaterial, LineSegments, AdditiveBlending: "AdditiveBlending" };

const { createConstellationLines } = await import("../src/universe/constellation-lines.mjs");

const STARS = [
  { id: "a", position: { x: 0, y: 0, z: 0 } },
  { id: "b", position: { x: 1, y: 0, z: 0 } },
  { id: "c", position: { x: 0, y: 1, z: 0 } },
];

test("creates a group with one LineSegments child", () => {
  const lines = createConstellationLines({ THREE, stars: STARS });
  assert.ok(lines.group instanceof Group);
  assert.equal(lines.group.children.length, 1);
  assert.ok(lines.group.children[0] instanceof LineSegments);
  lines.dispose();
});

test("3 stars produce 3 pair segments (6 positions)", () => {
  const lines = createConstellationLines({ THREE, stars: STARS });
  const geometry = lines.group.children[0].geometry;
  const positions = geometry.attributes.position.array;
  assert.equal(positions.length, 18); // 3 pairs * 2 points * 3 coords
  lines.dispose();
});

test("line material is additive, transparent, low opacity", () => {
  const lines = createConstellationLines({ THREE, stars: STARS });
  const material = lines.group.children[0].material;
  assert.equal(material.opts.blending, THREE.AdditiveBlending);
  assert.equal(material.opts.transparent, true);
  assert.ok(material.opts.opacity <= 0.2, "opacity must stay subtle");
  lines.dispose();
});

test("fewer than 2 stars creates empty group", () => {
  const lines = createConstellationLines({ THREE, stars: [{ id: "a", position: { x: 0, y: 0, z: 0 } }] });
  assert.equal(lines.group.children.length, 0);
  lines.dispose();
});
