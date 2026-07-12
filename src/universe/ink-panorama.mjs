const PANORAMA_ASSETS = Object.freeze({
  performance: Object.freeze({
    url: "/assets/images/ink-universe-panorama-v1-performance.png",
    resolution: 1024,
  }),
  balanced: Object.freeze({
    url: "/assets/images/ink-universe-panorama-v1-balanced.png",
    resolution: 1536,
  }),
  high: Object.freeze({
    url: "/assets/images/ink-universe-panorama-v1-high.png",
    resolution: 2048,
  }),
  cinematic: Object.freeze({
    url: "/assets/images/ink-universe-panorama-v1-cinematic.png",
    resolution: 3072,
  }),
});

export function getInkPanoramaAsset(profile) {
  return Object.freeze({
    ...(PANORAMA_ASSETS[profile.name] ?? PANORAMA_ASSETS.balanced),
    worldSeed: profile.worldSeed,
  });
}

export function loadInkPanorama(THREE, profile) {
  const { url } = getInkPanoramaAsset(profile);

  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.RepeatWrapping;
        resolve(texture);
      },
      undefined,
      reject,
    );
  });
}
