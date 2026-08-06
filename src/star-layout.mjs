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
