import test from "node:test";
import assert from "node:assert/strict";

import {
  clampCamera,
  createSceneStarLayout,
  createStarLayout,
  findNearestStar,
  projectStar,
} from "../src/star-layout.mjs";

const stars = [
  {
    title: "Current",
    date: "2026-06-09",
    year: 2026,
    type: "now",
    summary: "current",
    visibility: "public",
    current: true,
  },
  {
    title: "Middle",
    date: "2025-01-01",
    year: 2025,
    type: "milestone",
    summary: "middle",
    visibility: "public",
  },
  {
    title: "Old",
    date: "2024-01-01",
    year: 2024,
    type: "milestone",
    summary: "old",
    visibility: "public",
  },
];

test("places the current star closest to the viewer", () => {
  const layout = createStarLayout(stars);

  assert.equal(layout.stars[0].title, "Current");
  assert.equal(layout.stars[0].depth, 0);
  assert.ok(layout.stars[1].depth > layout.stars[0].depth);
  assert.ok(layout.stars[2].depth > layout.stars[1].depth);
});

test("uses a gentle curved path instead of a straight horizontal timeline", () => {
  const layout = createStarLayout(stars);
  const xs = layout.stars.map((star) => star.pathX);

  assert.ok(Math.abs(xs[0] - xs[1]) > 20);
  assert.ok(Math.abs(xs[1] - xs[2]) > 5);
  assert.ok(Math.max(...xs) - Math.min(...xs) < 360);
});

test("projects older stars smaller and dimmer than the current star", () => {
  const layout = createStarLayout(stars);
  const viewport = { width: 1200, height: 800 };
  const camera = { x: 0, y: 0, depth: 0 };
  const current = projectStar(layout.stars[0], camera, viewport);
  const old = projectStar(layout.stars[2], camera, viewport);

  assert.ok(current.radius > old.radius);
  assert.ok(current.opacity > old.opacity);
});

test("clamps camera movement near the star road bounds", () => {
  const layout = createStarLayout(stars);
  const camera = clampCamera({ x: 9999, y: -9999, depth: 9999 }, layout.bounds);

  assert.ok(camera.x <= layout.bounds.maxX);
  assert.ok(camera.y >= layout.bounds.minY);
  assert.ok(camera.depth <= layout.bounds.maxDepth);
});

test("finds the nearest projected star under a pointer", () => {
  const layout = createStarLayout(stars);
  const viewport = { width: 1200, height: 800 };
  const camera = { x: 0, y: 0, depth: 0 };
  const current = projectStar(layout.stars[0], camera, viewport);
  const found = findNearestStar(
    layout.stars,
    { x: current.x, y: current.y },
    camera,
    viewport,
  );

  assert.equal(found?.title, "Current");
});

test("creates bounded 3d scene positions for the star road", () => {
  const layout = createStarLayout(stars);
  const sceneLayout = createSceneStarLayout(layout.stars);

  assert.equal(sceneLayout.sceneStars[0].title, "Current");
  assert.ok(sceneLayout.sceneStars[0].position.z > sceneLayout.sceneStars[1].position.z);

  for (const star of sceneLayout.sceneStars) {
    assert.ok(star.position.x >= sceneLayout.bounds.minX);
    assert.ok(star.position.x <= sceneLayout.bounds.maxX);
    assert.ok(star.position.y >= sceneLayout.bounds.minY);
    assert.ok(star.position.y <= sceneLayout.bounds.maxY);
    assert.ok(star.position.z >= sceneLayout.bounds.minZ);
    assert.ok(star.position.z <= sceneLayout.bounds.maxZ);
  }

  assert.ok(sceneLayout.cameraLimits.minDistance > 0);
  assert.ok(sceneLayout.cameraLimits.maxDistance > sceneLayout.cameraLimits.minDistance);
  assert.ok(sceneLayout.sceneStars.length <= 1 || Math.abs(sceneLayout.sceneStars[0].position.z - sceneLayout.sceneStars[1].position.z) < 3.3);
});

test("keeps the current 3d star visually dominant in the hero scene", () => {
  const layout = createStarLayout(stars);
  const sceneLayout = createSceneStarLayout(layout.stars);
  const [current, next] = sceneLayout.sceneStars;

  assert.ok(current.radius >= next.radius * 1.25);
});

test("provides a mobile home camera focus that keeps the current star in frame", () => {
  const layout = createStarLayout(stars);
  const sceneLayout = createSceneStarLayout(layout.stars);
  const current = sceneLayout.sceneStars.find((star) => star.current);

  assert.ok(sceneLayout.homeFocus.mobile.x < current.position.x);
  assert.ok(sceneLayout.homeFocus.mobile.z < current.position.z);
});

test("anchors the current 3d star in the hero visual zone", () => {
  const layout = createStarLayout(stars);
  const scene = createSceneStarLayout(layout.stars);
  const current = scene.sceneStars.find((item) => item.current);

  assert.ok(current.position.x >= 0.55);
  assert.ok(current.position.z >= 2.65);
  assert.ok(current.radius >= 0.085);
});

test("uses a desktop home focus that frames the current star and star road", () => {
  const layout = createStarLayout(stars);
  const scene = createSceneStarLayout(layout.stars);

  assert.ok(scene.homeFocus.desktop.x >= 0.5);
  assert.ok(scene.homeFocus.desktop.z >= 1.9);
  assert.ok(scene.cameraLimits.maxDistance <= 8.8);
});
