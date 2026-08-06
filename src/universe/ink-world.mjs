import { getInkPanoramaAsset, loadInkPanorama } from "./ink-panorama.mjs";
import { INK_COLOR_GRADE } from "./ink-color-grade.mjs";
import { PANORAMA_SHELL_RADIUS } from "./world-constants.mjs";
import { createContentBeacons } from "./content-beacons.mjs";
import { createSkyTemperatureShell } from "./ink-sky-tint.mjs";

const WORLD_RADIUS = PANORAMA_SHELL_RADIUS;
const TIER_DENSITY = Object.freeze({
  core: { inkClouds: 8, silverGlints: 24 },
  balanced: { inkClouds: 12, silverGlints: 38 },
  high: { inkClouds: 17, silverGlints: 54 },
  cinematic: { inkClouds: 22, silverGlints: 72 },
});

const INK_MASS_LAYOUT = Object.freeze([
  // The first eight entries are the performance tier: each view direction keeps a mist mass.
  { position: [0.4, -0.9, -3.2], scale: [10.8, 5.2], rotation: -0.22, tone: 0 },
  { position: [-6.8, 5.8, -5.8], scale: [12.4, 6.4], rotation: 0.48, tone: 1 },
  { position: [10.6, 1.9, -11.4], scale: [13.8, 6.6], rotation: -0.66, tone: 2 },
  { position: [-1.8, -2.3, -6.6], scale: [9.2, 4.1], rotation: 0.36, tone: 1 },
  { position: [-8.9, 3.4, -8.5], scale: [10.2, 5.5], rotation: -0.18, tone: 2 },
  { position: [8.7, 4.8, -13.5], scale: [11.6, 5.3], rotation: 0.26, tone: 0 },
  { position: [2.8, 1.4, -8.8], scale: [8.4, 4.2], rotation: -0.48, tone: 1 },
  { position: [-4.4, 7.2, -10.8], scale: [9.6, 4.7], rotation: 0.68, tone: 2 },
  { position: [3.8, -2.4, -10.9], scale: [8.8, 3.8], rotation: 0.18, tone: 0 },
  { position: [-11.1, 1.1, -11.8], scale: [9.8, 4.4], rotation: -0.35, tone: 1 },
  { position: [12.2, -1.5, -15.2], scale: [10.5, 4.8], rotation: 0.51, tone: 2 },
  { position: [-0.7, 4.6, -12.4], scale: [8.3, 3.9], rotation: -0.08, tone: 0 },
  { position: [5.7, 0.3, -15.8], scale: [8.9, 4.1], rotation: 0.62, tone: 1 },
  { position: [-10.8, 7.7, -13.2], scale: [10.1, 4.9], rotation: -0.57, tone: 2 },
  { position: [13.4, 5.5, -17.1], scale: [9.7, 4.6], rotation: 0.14, tone: 0 },
  { position: [-3.9, -4.1, -13.9], scale: [8.1, 3.7], rotation: -0.41, tone: 1 },
  { position: [1.4, 7.6, -16.5], scale: [9.3, 4.2], rotation: 0.33, tone: 2 },
  { position: [-13.3, -1.8, -15.1], scale: [8.7, 4.0], rotation: 0.47, tone: 0 },
  { position: [11.5, 8.3, -18.4], scale: [8.9, 4.3], rotation: -0.29, tone: 1 },
  { position: [-6.2, 1.2, -17.8], scale: [8.0, 3.6], rotation: 0.11, tone: 2 },
  { position: [5.2, -4.8, -17.5], scale: [7.8, 3.5], rotation: -0.63, tone: 0 },
  { position: [-1.9, 9.6, -19.4], scale: [8.5, 3.9], rotation: 0.39, tone: 1 },
]);

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function getInkWorldPlan(profile) {
  const density = TIER_DENSITY[profile?.assetTier] ?? TIER_DENSITY.balanced;
  return Object.freeze({
    seed: Number(profile?.worldSeed ?? 611),
    radius: WORLD_RADIUS,
    inkClouds: density.inkClouds,
    silverGlints: density.silverGlints,
    vortexRings: 7,
  });
}

function canvasTexture(THREE, width, height, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  paint(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function drawWatercolor(context, width, height, seed, palette) {
  const rng = createRng(seed);
  context.clearRect(0, 0, width, height);
  context.globalCompositeOperation = "source-over";

  for (let pass = 0; pass < 18; pass += 1) {
    const x = width * (0.12 + rng() * 0.76);
    const y = height * (0.15 + rng() * 0.7);
    const rx = width * (0.09 + rng() * 0.25);
    const ry = height * (0.05 + rng() * 0.16);
    const color = palette[pass % palette.length];
    const alpha = 0.035 + rng() * 0.08;
    context.save();
    context.translate(x, y);
    context.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
    gradient.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);
    gradient.addColorStop(0.55, `${color}${Math.round(alpha * 90).toString(16).padStart(2, "0")}`);
    gradient.addColorStop(1, "#00000000");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, Math.max(rx, ry), 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function makeInkTexture(THREE, seed) {
  return canvasTexture(THREE, 512, 512, (context, width, height) => {
    drawWatercolor(context, width, height, seed, [
      INK_COLOR_GRADE.inkMistPrimary,
      INK_COLOR_GRADE.inkMistDeep,
      INK_COLOR_GRADE.inkMistBright,
      INK_COLOR_GRADE.inkMistShadow,
    ]);
    context.globalCompositeOperation = "destination-out";
    const rng = createRng(seed + 31);
    for (let index = 0; index < 11; index += 1) {
      const x = rng() * width;
      const y = rng() * height;
      const radius = 22 + rng() * 96;
      const clear = context.createRadialGradient(x, y, 0, x, y, radius);
      clear.addColorStop(0, "rgba(0,0,0,0.46)");
      clear.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = clear;
      context.fillRect(0, 0, width, height);
    }
  });
}

function createInkClouds(THREE, plan) {
  const group = new THREE.Group();
  group.name = "InkMasses";
  const rng = createRng(plan.seed + 13);
  const inkTexture = makeInkTexture(THREE, plan.seed + 29);

  for (let index = 0; index < INK_MASS_LAYOUT.length; index += 1) {
    const layout = INK_MASS_LAYOUT[index];
    const cloud = new THREE.Sprite(new THREE.SpriteMaterial({
      map: inkTexture,
      color: layout.tone === 0 ? INK_COLOR_GRADE.cloudPrimary : INK_COLOR_GRADE.cloudDeep,
      transparent: true,
      opacity: 0.18 + layout.tone * 0.025 + rng() * 0.04,
      depthWrite: false,
      blending: THREE.NormalBlending,
    }));
    cloud.position.set(...layout.position);
    cloud.scale.set(layout.scale[0], layout.scale[1], 1);
    cloud.material.rotation = layout.rotation;
    cloud.userData.qualityIndex = index;
    cloud.userData.phase = index * 0.73;
    group.add(cloud);
  }
  return group;
}

function createVortex(THREE, plan) {
  const group = new THREE.Group();
  group.name = "DistantInkVortex";
  group.position.set(-11.8, 5.1, 7.2);
  group.rotation.set(0.36, -0.55, 0.18);

  for (let ring = 0; ring < plan.vortexRings; ring += 1) {
    const points = [];
    const radius = 0.75 + ring * 0.29;
    for (let step = 0; step <= 96; step += 1) {
      const t = step / 96;
      const angle = t * Math.PI * 2.7 + ring * 0.54;
      const currentRadius = radius * (0.32 + t * 0.68);
      points.push(new THREE.Vector3(
        Math.cos(angle) * currentRadius,
        Math.sin(angle) * currentRadius * 0.72,
        (t - 0.5) * 0.34,
      ));
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({
        color: ring === 0 ? INK_COLOR_GRADE.riverSilver : INK_COLOR_GRADE.vortexTeal,
        transparent: true,
        opacity: ring === 0 ? 0.26 : 0.14,
        depthWrite: false,
      }),
    );
    group.add(line);
  }
  return group;
}

// 三层星尘：前景大星（亮、含暖金）→ 中景密度 → 背景小星尘（暗、远），制造景深。
// 各层容量固定，drawRange 随画质档位按比例缩放（与原有单点云行为一致，且不越界）。
const GLINT_LAYERS = Object.freeze([
  { key: "fg",  cap: 14, size: 0.09,  opacity: 0.85, radiusMin: 9,  radiusMax: 12, goldChance: 0.13 },
  { key: "mid", cap: 24, size: 0.045, opacity: 0.55, radiusMin: 12, radiusMax: 16, goldChance: 0.06 },
  { key: "bg",  cap: 40, size: 0.018, opacity: 0.30, radiusMin: 16, radiusMax: 21, goldChance: 0.03 },
]);
const GLINT_TOTAL_CAP = GLINT_LAYERS.reduce((sum, layer) => sum + layer.cap, 0);

function createSilverGlints(THREE, plan) {
  const group = new THREE.Group();
  group.name = "SilverGlints";
  const silver = new THREE.Color(INK_COLOR_GRADE.riverSilver);
  const gold = new THREE.Color(INK_COLOR_GRADE.goldGlint);
  const layers = GLINT_LAYERS.map((layer, layerIndex) => {
    const positions = new Float32Array(layer.cap * 3);
    const colors = new Float32Array(layer.cap * 3);
    const rng = createRng((plan.seed ?? 611) + 101 + layerIndex * 37);
    for (let index = 0; index < layer.cap; index += 1) {
      const phi = Math.acos(1 - 2 * rng());
      const theta = rng() * Math.PI * 2;
      const radius = layer.radiusMin + rng() * (layer.radiusMax - layer.radiusMin);
      positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      positions[index * 3 + 1] = Math.cos(phi) * radius;
      positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
      const color = rng() < layer.goldChance ? gold : silver;
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setDrawRange(0, layer.cap);
    const material = new THREE.PointsMaterial({
      vertexColors: true,
      size: layer.size,
      transparent: true,
      opacity: layer.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material);
    points.name = `glints-${layer.key}`;
    group.add(points);
    return { points, cap: layer.cap };
  });
  group.userData.layers = layers;
  group.userData.totalCap = GLINT_TOTAL_CAP;
  applyGlintQuality(group, plan.silverGlints);
  return group;
}

function applyGlintQuality(glintsGroup, silverGlints) {
  const totalCap = glintsGroup.userData.totalCap;
  for (const entry of glintsGroup.userData.layers) {
    const draw = Math.round((entry.cap / totalCap) * silverGlints);
    entry.points.geometry.setDrawRange(0, Math.max(0, Math.min(entry.cap, draw)));
  }
}

export async function createInkUniverseWorld({ THREE, profile, layout }) {
  const panorama = await loadInkPanorama(THREE, profile);
  try {
    return createInkUniverseWorldFromPanorama({ THREE, profile, panorama, layout });
  } catch (error) {
    panorama.dispose?.();
    throw error;
  }
}

function createInkUniverseWorldFromPanorama({ THREE, profile, panorama, layout }) {
  const group = new THREE.Group();
  group.name = "InkUniverseWorld";
  const plan = getInkWorldPlan(profile);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(plan.radius, 96, 64),
    new THREE.MeshBasicMaterial({
      map: panorama,
      color: INK_COLOR_GRADE.skyTint,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  sky.name = "InkSkyShell";
  // Level 1 · 背景天穹色温分层：在 panorama 内层叠加低透明多中心径向渐变壳。
  const skyTint = createSkyTemperatureShell(THREE, {
    radius: plan.radius * 0.985,
    seed: plan.seed,
    canvasTexture,
  });
  skyTint.name = "InkSkyTintShell";
  const clouds = createInkClouds(THREE, plan);
  const vortex = createVortex(THREE, plan);
  const glints = createSilverGlints(THREE, plan);
  group.add(sky, skyTint, clouds, vortex, glints);

  // Content beacons
  let beacons = null;
  if (layout && layout.sceneStars && layout.sceneStars.length > 0) {
    beacons = createContentBeacons({ THREE, layout });
    group.add(beacons.group);
  }

  let disposed = false;

  function setQuality(nextProfile) {
    const nextPlan = getInkWorldPlan(nextProfile);
    const nextPanorama = getInkPanoramaAsset(nextProfile);
    panorama.anisotropy = Math.max(1, Math.min(4, Math.round(nextPanorama.resolution / 1024)));
    panorama.needsUpdate = true;
    for (const cloud of clouds.children) {
      cloud.visible = cloud.userData.qualityIndex < nextPlan.inkClouds;
    }
    applyGlintQuality(glints, nextPlan.silverGlints);
  }

  function update(time, camera, experience) {
    clouds.rotation.y = time * 0.000006;
    vortex.rotation.z = time * 0.000025;
    for (const cloud of clouds.children) {
      cloud.material.rotation += Math.sin(time * 0.0002 + cloud.userData.phase) * 0.00004;
    }
    if (beacons) {
      beacons.update(time, camera, experience);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (beacons) {
      beacons.dispose();
    }
    const textures = new Set();
    group.traverse((object) => {
      object.geometry?.dispose?.();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        if (material.map && !textures.has(material.map)) {
          textures.add(material.map);
          material.map.dispose?.();
        }
        material.dispose?.();
      }
    });
  }

  setQuality(profile);
  return Object.freeze({ group, setQuality, update, dispose, getBeacons: () => beacons });
}
