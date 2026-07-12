import { getInkPanoramaAsset, loadInkPanorama } from "./ink-panorama.mjs";

const WORLD_RADIUS = 23.6;
const TIER_DENSITY = Object.freeze({
  core: { inkClouds: 8, silverGlints: 24 },
  balanced: { inkClouds: 12, silverGlints: 38 },
  high: { inkClouds: 17, silverGlints: 54 },
  cinematic: { inkClouds: 22, silverGlints: 72 },
});

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
    riverStrands: 13,
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
    drawWatercolor(context, width, height, seed, ["#153f52", "#0b2737", "#276276", "#071722"]);
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

  for (let index = 0; index < TIER_DENSITY.cinematic.inkClouds; index += 1) {
    const cloud = new THREE.Sprite(new THREE.SpriteMaterial({
      map: inkTexture,
      color: index % 5 === 0 ? 0x4d8596 : 0x1f596c,
      transparent: true,
      opacity: 0.22 + rng() * 0.2,
      depthWrite: false,
      blending: THREE.NormalBlending,
    }));
    const phi = Math.acos(1 - 2 * rng());
    const theta = rng() * Math.PI * 2;
    const radius = 15.5 + rng() * 5.8;
    cloud.position.set(
      Math.sin(phi) * Math.cos(theta) * radius,
      Math.cos(phi) * radius,
      Math.sin(phi) * Math.sin(theta) * radius,
    );
    cloud.scale.set(5 + rng() * 7, 3 + rng() * 4.4, 1);
    cloud.material.rotation = rng() * Math.PI;
    cloud.userData.qualityIndex = index;
    cloud.userData.phase = rng() * Math.PI * 2;
    group.add(cloud);
  }
  return group;
}

function createRiver(THREE, plan) {
  const group = new THREE.Group();
  group.name = "FlowingInkRiver";
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.5, -3.1, 8.4),
    new THREE.Vector3(-1.5, -1.4, 3.2),
    new THREE.Vector3(1.1, -0.4, -2.2),
    new THREE.Vector3(3.4, 1.2, -7.8),
    new THREE.Vector3(1.2, 3.7, -14),
  ]);

  for (let strand = 0; strand < plan.riverStrands; strand += 1) {
    const points = [];
    const offset = (strand - (plan.riverStrands - 1) / 2) * 0.11;
    for (let index = 0; index <= 110; index += 1) {
      const t = index / 110;
      const point = curve.getPoint(t);
      const tangent = curve.getTangent(t).normalize();
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const weave = Math.sin(t * Math.PI * (3 + strand * 0.14) + strand) * 0.09;
      points.push(point.add(side.multiplyScalar(offset + weave)));
    }
    const material = new THREE.LineBasicMaterial({
      color: strand % 5 === 0 ? 0x9ab8c0 : 0x1d7387,
      transparent: true,
      opacity: strand % 5 === 0 ? 0.22 : 0.12,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
    line.userData.phase = strand * 0.47;
    group.add(line);
  }
  return group;
}

function createVortex(THREE, plan) {
  const group = new THREE.Group();
  group.name = "DistantInkVortex";
  group.position.set(-8.4, 5.2, -14.2);
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
        color: ring === 0 ? 0xc0d1d4 : 0x2a788c,
        transparent: true,
        opacity: ring === 0 ? 0.26 : 0.14,
        depthWrite: false,
      }),
    );
    group.add(line);
  }
  return group;
}

function createSilverGlints(THREE, plan) {
  const count = TIER_DENSITY.cinematic.silverGlints;
  const rng = createRng(plan.seed + 101);
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const phi = Math.acos(1 - 2 * rng());
    const theta = rng() * Math.PI * 2;
    const radius = 10 + rng() * 11;
    positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[index * 3 + 1] = Math.cos(phi) * radius;
    positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setDrawRange(0, plan.silverGlints);
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0xd6e4e6,
    size: 0.045,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  return points;
}

export async function createInkUniverseWorld({ THREE, profile }) {
  const group = new THREE.Group();
  group.name = "InkUniverseWorld";
  const plan = getInkWorldPlan(profile);
  const panorama = await loadInkPanorama(THREE, profile);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(plan.radius, 96, 64),
    new THREE.MeshBasicMaterial({
      map: panorama,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  sky.name = "InkSkyShell";
  const clouds = createInkClouds(THREE, plan);
  const river = createRiver(THREE, plan);
  const vortex = createVortex(THREE, plan);
  const glints = createSilverGlints(THREE, plan);
  group.add(sky, clouds, river, vortex, glints);
  let disposed = false;

  function setQuality(nextProfile) {
    const nextPlan = getInkWorldPlan(nextProfile);
    const nextPanorama = getInkPanoramaAsset(nextProfile);
    panorama.anisotropy = Math.max(1, Math.min(4, Math.round(nextPanorama.resolution / 1024)));
    panorama.needsUpdate = true;
    for (const cloud of clouds.children) {
      cloud.visible = cloud.userData.qualityIndex < nextPlan.inkClouds;
    }
    glints.geometry.setDrawRange(0, nextPlan.silverGlints);
  }

  function update(time) {
    clouds.rotation.y = time * 0.000006;
    vortex.rotation.z = time * 0.000025;
    river.rotation.y = Math.sin(time * 0.00012) * 0.035;
    for (const cloud of clouds.children) {
      cloud.material.rotation += Math.sin(time * 0.0002 + cloud.userData.phase) * 0.00004;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
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
  return Object.freeze({ group, setQuality, update, dispose });
}
