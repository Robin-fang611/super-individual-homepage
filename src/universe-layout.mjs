export function createSeededRng(seed) {
  let value = seed >>> 0;
  return function rng() {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

export function createBackgroundStars({ count, seed, width, height }) {
  const rng = createSeededRng(seed);
  const stars = [];

  for (let index = 0; index < count; index += 1) {
    const layerRoll = rng();
    const layer = layerRoll < 0.5 ? "far" : layerRoll < 0.85 ? "mid" : "near";

    stars.push({
      id: `star-${seed}-${index}`,
      x: (rng() - 0.5) * width,
      y: (rng() - 0.5) * height,
      radius: layer === "near" ? 1.2 + rng() * 1.8 : layer === "mid" ? 0.7 + rng() * 1.2 : 0.35 + rng() * 0.8,
      alpha: layer === "near" ? 0.42 + rng() * 0.48 : layer === "mid" ? 0.25 + rng() * 0.36 : 0.14 + rng() * 0.24,
      warmth: rng() > 0.9 ? 1 : 0,
      layer,
      phase: rng() * Math.PI * 2,
    });
  }

  return stars;
}

export function createRecordNodes(records, { width, height }) {
  const sorted = [...records].sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
  const count = Math.max(1, sorted.length);

  return sorted.map((record, index) => {
    const progress = count === 1 ? 0 : index / (count - 1);
    const riverX = width * (0.34 - progress * 0.68);
    const riverY = Math.sin(progress * Math.PI * 1.3 - 0.35) * height * 0.18;
    const curveNoise = Math.sin(index * 1.91 + 0.42) * height * 0.05;
    const importance = Number.isFinite(record.importance) ? Math.min(Math.max(record.importance, 0), 1) : 0.5;
    const radius = 6 + importance * 8;

    return {
      ...record,
      x: riverX,
      y: riverY + curveNoise,
      radius,
      revealRadius: Math.max(34, radius * 4.4),
      glow: 0.45 + importance * 0.55,
      progress,
    };
  });
}

export function getParallaxOffset(pan, strength) {
  return {
    x: Math.round(-pan.x * strength),
    y: Math.round(-pan.y * strength),
  };
}

export function clampDepth(depth) {
  const value = Number.isFinite(depth) ? depth : 1;
  return Math.min(Math.max(value, 0.58), 1.8);
}

export function getDepthScale(depth) {
  return clampDepth(depth);
}

function normalizeWheelDelta(value, deltaMode = 0) {
  const multiplier = deltaMode === 1 ? 16 : deltaMode === 2 ? 120 : 1;
  return Number(value || 0) * multiplier;
}

export function applyTrackpadMovement(camera, wheel, world, viewport) {
  const pan = camera.pan ?? { x: 0, y: 0 };
  const depth = clampDepth(camera.depth ?? 1);
  const deltaX = normalizeWheelDelta(wheel.deltaX, wheel.deltaMode);
  const deltaY = normalizeWheelDelta(wheel.deltaY, wheel.deltaMode);
  const depthGesture = wheel.ctrlKey === true || wheel.metaKey === true || wheel.shiftKey === true;

  if (depthGesture) {
    return {
      pan: { ...pan },
      depth: clampDepth(depth - deltaY * 0.002),
    };
  }

  return {
    pan: clampPan(
      {
        x: pan.x + deltaX * 1.12,
        y: pan.y + deltaY * 1.12,
      },
      world,
      viewport,
    ),
    depth,
  };
}

export function clampPan(pan, world, viewport) {
  const maxX = Math.max(0, (world.width - viewport.width) * 0.6);
  const maxY = Math.max(0, (world.height - viewport.height) * 0.7);

  return {
    x: Math.min(Math.max(pan.x, -maxX), maxX),
    y: Math.min(Math.max(pan.y, -maxY), maxY),
  };
}

export function hitTestNode(nodes, point) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const node of nodes) {
    const distance = Math.hypot(point.x - node.screenX, point.y - node.screenY);
    if (distance <= node.revealRadius && distance < nearestDistance) {
      nearest = node;
      nearestDistance = distance;
    }
  }

  return nearest;
}
