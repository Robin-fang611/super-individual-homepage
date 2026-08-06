import { INK_COLOR_GRADE } from "./ink-color-grade.mjs";

const MAX_FULL_CONNECTIONS = 40;
const MAX_NEAREST_CONNECTIONS = 3;

/**
 * 星座线：星标间的若有若无连线，展示世界的结构感。
 * 星数少时全对连线；星数多时退化为最近邻，避免蜘蛛网。
 */
export function createConstellationLines({ THREE, stars }) {
  const group = new THREE.Group();
  group.name = "ConstellationLines";

  const pairs = buildPairs(stars);
  if (pairs.length === 0) {
    return { group, dispose() { group.clear(); } };
  }

  const positions = new Float32Array(pairs.length * 6);
  for (let index = 0; index < pairs.length; index += 1) {
    const [a, b] = pairs[index];
    positions[index * 6] = a.position.x;
    positions[index * 6 + 1] = a.position.y;
    positions[index * 6 + 2] = a.position.z;
    positions[index * 6 + 3] = b.position.x;
    positions[index * 6 + 4] = b.position.y;
    positions[index * 6 + 5] = b.position.z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: INK_COLOR_GRADE.riverSilver,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(geometry, material);
  group.add(lines);

  return {
    group,
    dispose() {
      geometry.dispose();
      material.dispose();
      group.clear();
    },
  };
}

function buildPairs(stars) {
  const count = stars.length;
  if (count < 2) return [];

  if (count <= MAX_FULL_CONNECTIONS) {
    const pairs = [];
    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        pairs.push([stars[i], stars[j]]);
      }
    }
    return pairs;
  }

  // 大星数：每颗星连最近的 N 颗（无向去重）
  const pairs = [];
  const seen = new Set();
  for (const star of stars) {
    const neighbors = [...stars]
      .filter((other) => other !== star)
      .sort((a, b) => distanceSq(star, a) - distanceSq(star, b))
      .slice(0, MAX_NEAREST_CONNECTIONS);
    for (const neighbor of neighbors) {
      const key = star.id < neighbor.id ? `${star.id}|${neighbor.id}` : `${neighbor.id}|${star.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push([star, neighbor]);
      }
    }
  }
  return pairs;
}

function distanceSq(a, b) {
  return (
    (a.position.x - b.position.x) ** 2 +
    (a.position.y - b.position.y) ** 2 +
    (a.position.z - b.position.z) ** 2
  );
}
