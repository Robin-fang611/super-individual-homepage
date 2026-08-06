import { INK_COLOR_GRADE } from "./ink-color-grade.mjs";

export const GUIDE_STREAM_PARTICLE_COUNT = 40;

/**
 * 星路顺序中第一个未访问的星标 id；全访问完返回 null。
 * 当前星不在候选内（它永远已访问）。
 */
export function nextUnvisitedTarget(orderedIds, visited, currentId) {
  for (const id of orderedIds) {
    if (id === currentId) continue;
    if (!visited.has(id)) return id;
  }
  return null;
}

/**
 * 引导流：从 current 星飘向"下一颗未访问星"的星尘流。
 * 32 个粒子沿两星间线段流动，Additive 混合，极克制。
 */
export function createGuideStream({ THREE, stars, currentId }) {
  const group = new THREE.Group();
  group.name = "GuideStream";

  const byId = new Map(stars.map((star) => [star.id, star]));
  const orderedIds = stars.map((star) => star.id);
  const current = byId.get(currentId) ?? stars[0];

  const source = current ? current.position : { x: 0, y: 0, z: 0 };
  let targetId = null;
  let target = null;

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(GUIDE_STREAM_PARTICLE_COUNT * 3);
  const jitter = new Float32Array(GUIDE_STREAM_PARTICLE_COUNT);
  for (let index = 0; index < GUIDE_STREAM_PARTICLE_COUNT; index += 1) {
    positions[index * 3] = source.x;
    positions[index * 3 + 1] = source.y;
    positions[index * 3 + 2] = source.z;
    jitter[index] = (index / GUIDE_STREAM_PARTICLE_COUNT) * 0.35;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: INK_COLOR_GRADE.goldGlint,
    size: 0.075,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  group.add(points);

  const visited = new Set([currentId]);

  function refreshTarget() {
    const nextId = nextUnvisitedTarget(orderedIds, visited, currentId);
    targetId = nextId;
    target = nextId ? byId.get(nextId) : null;
    if (!target) {
      material.visible = false;
      return;
    }
    material.visible = true;
    // 重置偏移，粒子从头开始流动
    for (let index = 0; index < GUIDE_STREAM_PARTICLE_COUNT; index += 1) {
      positions[index * 3] = source.x;
      positions[index * 3 + 1] = source.y;
      positions[index * 3 + 2] = source.z;
    }
    geometry.attributes.position.needsUpdate = true;
  }

  function markVisited(id) {
    if (visited.has(id)) return;
    visited.add(id);
    refreshTarget();
  }

  function update(time) {
    if (!target) return;

    const speed = 0.00018;
    for (let index = 0; index < GUIDE_STREAM_PARTICLE_COUNT; index += 1) {
      // 粒子集中在线段近端 45%，形成"从星标涌出"的流
      const t = (time * speed + index / GUIDE_STREAM_PARTICLE_COUNT + jitter[index]) % 0.45;
      const eased = t * t * (3 - 2 * t);
      positions[index * 3] = source.x + (target.position.x - source.x) * eased;
      positions[index * 3 + 1] = source.y + (target.position.y - source.y) * eased;
      positions[index * 3 + 2] = source.z + (target.position.z - source.z) * eased;
    }
    geometry.attributes.position.needsUpdate = true;
  }

  refreshTarget();

  return {
    group,
    markVisited,
    getTargetId: () => targetId,
    update,
    dispose() {
      geometry.dispose();
      material.dispose();
      group.clear();
    },
  };
}
