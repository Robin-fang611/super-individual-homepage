function byCurrentThenDate(left, right) {
  if (left.current && !right.current) {
    return -1;
  }

  if (!left.current && right.current) {
    return 1;
  }

  return Date.parse(right.date) - Date.parse(left.date);
}

function pathPoint(index) {
  return {
    pathX: index * 92 + Math.sin(index * 0.86) * 78,
    pathY: index * 170,
    depth: index,
  };
}

export function createStarLayout(stars) {
  const laidOutStars = [...stars].sort(byCurrentThenDate).map((star, index) => ({
    ...star,
    id: star.file ?? `${star.date}-${star.title}`,
    ...pathPoint(index),
  }));

  const xs = laidOutStars.map((star) => star.pathX);
  const ys = laidOutStars.map((star) => star.pathY);
  const depths = laidOutStars.map((star) => star.depth);

  return {
    stars: laidOutStars,
    bounds: {
      minX: Math.min(...xs, 0) - 220,
      maxX: Math.max(...xs, 0) + 220,
      minY: Math.min(...ys, 0) - 180,
      maxY: Math.max(...ys, 0) + 180,
      minDepth: Math.min(...depths, 0),
      maxDepth: Math.max(...depths, 0) + 1,
    },
  };
}

export function clampCamera(camera, bounds) {
  return {
    x: Math.min(Math.max(camera.x, bounds.minX), bounds.maxX),
    y: Math.min(Math.max(camera.y, bounds.minY), bounds.maxY),
    depth: Math.min(Math.max(camera.depth, bounds.minDepth), bounds.maxDepth),
  };
}

export function projectStar(star, camera, viewport) {
  const relativeDepth = Math.max(0, star.depth - camera.depth);
  const perspective = 1 / (1 + relativeDepth * 0.32);
  const frontBias = star.current ? 1.15 : 1;
  const radius = Math.max(2.8, 9 * perspective * frontBias);
  const opacity = Math.max(0.34, 0.96 * perspective);
  const anchorX = viewport.width * 0.58;
  const anchorY = viewport.height * 0.75;

  return {
    ...star,
    x: anchorX + (star.pathX - camera.x) * perspective,
    y: anchorY - (star.pathY - camera.y) * perspective,
    radius,
    opacity,
    perspective,
  };
}

export function findNearestStar(stars, point, camera, viewport) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const star of stars) {
    const projected = projectStar(star, camera, viewport);
    const distance = Math.hypot(projected.x - point.x, projected.y - point.y);
    const hitRadius = Math.max(16, projected.radius + 10);

    if (distance <= hitRadius && distance < nearestDistance) {
      nearest = projected;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export function createSceneStarLayout(stars) {
  const sceneStars = stars.map((star, index) => {
    const progress = stars.length <= 1 ? 0 : index / (stars.length - 1);
    const angle = -0.55 + progress * Math.PI * 1.55;
    const radius = 1.28 + Math.sin(progress * Math.PI) * 0.72;
    const lateralSweep = 0.82 - progress * 1.45;

    return {
      ...star,
      position: {
        x: Math.cos(angle) * radius + lateralSweep,
        y: 0.42 - progress * 1.08 + Math.sin(angle * 1.18) * 0.32,
        z: 3.15 - progress * 8.7 + Math.sin(angle) * 0.72,
      },
      radius: star.current ? 0.09 : 0.066,
    };
  });
  const currentStar = sceneStars.find((star) => star.current) ?? sceneStars[0];
  const currentPosition = currentStar?.position ?? { x: 0, y: 0, z: 0 };

  return {
    sceneStars,
    bounds: {
      minX: -3.8,
      maxX: 4.15,
      minY: -1.7,
      maxY: 1.7,
      minZ: -6.4,
      maxZ: 4.2,
    },
    cameraLimits: {
      minDistance: 3.1,
      maxDistance: 8.6,
      minPolarAngle: Math.PI * 0.23,
      maxPolarAngle: Math.PI * 0.75,
    },
    homeFocus: {
      desktop: {
        x: currentPosition.x - 0.18,
        y: currentPosition.y - 0.02,
        z: currentPosition.z - 0.35,
      },
      mobile: {
        x: currentPosition.x - 0.28,
        y: currentPosition.y - 0.1,
        z: currentPosition.z - 0.62,
      },
    },
  };
}
