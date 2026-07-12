const PANORAMA_URL = "/assets/images/ink-universe-panorama-v1.png";
const RESOLUTIONS = Object.freeze({
  performance: 1024,
  balanced: 1536,
  high: 2048,
  cinematic: 3072,
});

export function getInkPanoramaAsset(profile) {
  return Object.freeze({
    url: PANORAMA_URL,
    resolution: RESOLUTIONS[profile.name] ?? RESOLUTIONS.balanced,
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
