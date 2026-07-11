import { createSceneStarLayout } from "./star-layout.mjs?v=3d-scene-25";
import { createInputRouter } from "./universe/input-router.mjs";
import { createFlightState } from "./universe/flight-model.mjs";
import { createUniverseRuntime } from "./universe/runtime.mjs";

const THREE_URL = "/assets/three.module.js";
const BACKDROP_URL = "/assets/images/star-road-hero-composed.png";
const BACKDROP_WIDTH_MULTIPLIER = 3;
const BACKDROP_SURFACE_PROFILE = Object.freeze({
  shape: "cylinder",
  widthMultiplier: BACKDROP_WIDTH_MULTIPLIER,
  hasPoleConvergence: false,
});
const STAR_ROAD_VISUAL_PROFILE = Object.freeze({
  broadRibbonLayers: 0,
  continuousPathLine: false,
  style: "broken-ink-strands",
});
const STRONG_HERO_VISUAL_PROFILE = Object.freeze({
  currentStar: {
    coreScaleMultiplier: 5.4,
    haloScale: 1.08,
    haloOpacity: 0.3,
    orbitRingOpacity: 0.24,
  },
  starRiver: {
    foreground: { count: 190, size: 0.105, opacity: 1 },
    mid: { count: 500, size: 0.056, opacity: 0.72 },
    background: { count: 560, size: 0.026, opacity: 0.36 },
  },
  backdrop: {
    sourceImageAlpha: 0.48,
    leftTitleMaskOpacity: 0.48,
    centerGlowOpacity: 0.2,
  },
});
const MOBILE_QUERY = "(max-width: 760px)";
let threeModulePromise;

function loadThree() {
  if (!threeModulePromise) {
    threeModulePromise = import(THREE_URL);
  }

  return threeModulePromise;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function readCanvasTheme() {
  const style = getComputedStyle(document.documentElement);
  const get = (name) => style.getPropertyValue(name).trim();

  return {
    ice: get("--ice-rgb") || "130, 223, 255",
    iceStrong: get("--ice-strong-rgb") || "185, 241, 255",
    gold: get("--gold-rgb") || "216, 184, 106",
  };
}

function rgbToColor(rgb, fallback) {
  const parts = String(rgb)
    .split(",")
    .map((value) => Number(value.trim()));

  if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) {
    return fallback;
  }

  return (parts[0] << 16) + (parts[1] << 8) + parts[2];
}

function vectorFromPosition(THREE, position) {
  return new THREE.Vector3(position.x, position.y, position.z);
}

function loadTexture(THREE, url) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        resolve(texture);
      },
      undefined,
      reject,
    );
  });
}

export function getNaturalBackdropSize(image) {
  return {
    width: image.width * BACKDROP_WIDTH_MULTIPLIER,
    height: image.height,
  };
}

export function getBackdropSurfaceProfile() {
  return { ...BACKDROP_SURFACE_PROFILE };
}

export function getStarRoadVisualProfile() {
  return { ...STAR_ROAD_VISUAL_PROFILE };
}

export function getStrongHeroVisualProfile() {
  return {
    currentStar: { ...STRONG_HERO_VISUAL_PROFILE.currentStar },
    starRiver: {
      foreground: { ...STRONG_HERO_VISUAL_PROFILE.starRiver.foreground },
      mid: { ...STRONG_HERO_VISUAL_PROFILE.starRiver.mid },
      background: { ...STRONG_HERO_VISUAL_PROFILE.starRiver.background },
    },
    backdrop: { ...STRONG_HERO_VISUAL_PROFILE.backdrop },
  };
}

function createSeededRng(seed) {
  let value = seed >>> 0;
  return function rng() {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function drawBackdropNebula(context, x, y, radiusX, radiusY, opacity, warmth = 0) {
  const radius = Math.max(radiusX, radiusY);
  const center = warmth > 0
    ? `rgba(216, 184, 106, ${opacity * 0.52})`
    : `rgba(154, 219, 236, ${opacity})`;
  const middle = warmth > 0
    ? `rgba(124, 104, 86, ${opacity * 0.22})`
    : `rgba(50, 119, 150, ${opacity * 0.34})`;
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, center);
  gradient.addColorStop(0.38, middle);
  gradient.addColorStop(0.72, `rgba(18, 42, 58, ${opacity * 0.08})`);
  gradient.addColorStop(1, "rgba(8, 18, 32, 0)");

  context.save();
  context.translate(x, y);
  context.scale(radiusX / radius, radiusY / radius);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function makeNaturalBackdropTexture(THREE, sourceTexture) {
  const image = sourceTexture.image;

  if (!image?.width || !image?.height) {
    return sourceTexture;
  }

  const { width, height } = getNaturalBackdropSize(image);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const rng = createSeededRng(73);
  const profile = STRONG_HERO_VISUAL_PROFILE;

  // 1. Rich dark base with subtle color variation
  const baseGrad = context.createLinearGradient(0, 0, width * 0.5, height * 0.8);
  baseGrad.addColorStop(0, "#02040b");
  baseGrad.addColorStop(0.3, "#050a18");
  baseGrad.addColorStop(0.6, "#0a1628");
  baseGrad.addColorStop(0.85, "#0d1b2a");
  baseGrad.addColorStop(1, "#061322");
  context.fillStyle = baseGrad;
  context.fillRect(0, 0, width, height);

  // 2. Subtle purple-blue glow from upper areas
  const purpleGlow = context.createRadialGradient(width * 0.35, height * 0.25, 0, width * 0.35, height * 0.25, width * 0.4);
  purpleGlow.addColorStop(0, "rgba(26, 28, 46, 0.5)");
  purpleGlow.addColorStop(0.5, "rgba(13, 27, 42, 0.2)");
  purpleGlow.addColorStop(1, "rgba(2, 4, 11, 0)");
  context.fillStyle = purpleGlow;
  context.fillRect(0, 0, width, height);

  // 3. Warm tint area in upper-right (subtle)
  const warmGlow = context.createRadialGradient(width * 0.72, height * 0.2, 0, width * 0.72, height * 0.2, width * 0.35);
  warmGlow.addColorStop(0, "rgba(216, 184, 106, 0.04)");
  warmGlow.addColorStop(1, "rgba(2, 4, 11, 0)");
  context.fillStyle = warmGlow;
  context.fillRect(0, 0, width, height);

  // 4. Original image blended in
  context.save();
  context.globalAlpha = profile.backdrop.sourceImageAlpha;
  context.drawImage(image, 0, 0, image.width, height);
  context.restore();

  const titleMask = context.createLinearGradient(0, 0, width * 0.42, 0);
  titleMask.addColorStop(0, `rgba(2, 4, 11, ${profile.backdrop.leftTitleMaskOpacity})`);
  titleMask.addColorStop(0.55, "rgba(2, 4, 11, 0.18)");
  titleMask.addColorStop(1, "rgba(2, 4, 11, 0)");
  context.fillStyle = titleMask;
  context.fillRect(0, 0, width * 0.5, height);

  const heroGlow = context.createRadialGradient(
    width * 0.48,
    height * 0.48,
    0,
    width * 0.48,
    height * 0.48,
    width * 0.28,
  );
  heroGlow.addColorStop(0, `rgba(185, 241, 255, ${profile.backdrop.centerGlowOpacity})`);
  heroGlow.addColorStop(0.42, "rgba(82, 159, 201, 0.08)");
  heroGlow.addColorStop(1, "rgba(2, 4, 11, 0)");
  context.fillStyle = heroGlow;
  context.fillRect(0, 0, width, height);

  // 5. Wide seamless extension
  const extGrad = context.createLinearGradient(image.width * 0.4, 0, image.width * 1.3, height * 0.6);
  extGrad.addColorStop(0, "rgba(5, 10, 24, 0)");
  extGrad.addColorStop(0.4, "rgba(8, 18, 34, 0.2)");
  extGrad.addColorStop(1, "rgba(5, 10, 24, 0.5)");
  context.fillStyle = extGrad;
  context.fillRect(image.width * 0.4, 0, width - image.width * 0.4, height);

  // 6. Procedural nebula across the whole canvas (not just extension)
  context.save();
  context.globalCompositeOperation = "screen";
  for (let n = 0; n < 16; n++) {
    const x = rng() * width * 0.8 + width * 0.1;
    const y = rng() * height;
    const rx = 150 + rng() * 400;
    const ry = 80 + rng() * 250;
    const opacity = 0.06 + rng() * 0.12;
    drawBackdropNebula(context, x, y, rx, ry, opacity, n % 5 === 0 ? 1 : 0);
  }
  context.restore();

  // 7. Edge fade for seam
  const seamGrad = context.createLinearGradient(image.width - 250, 0, image.width + 500, 0);
  seamGrad.addColorStop(0, "rgba(5, 10, 24, 0)");
  seamGrad.addColorStop(0.5, "rgba(7, 16, 30, 0.20)");
  seamGrad.addColorStop(1, "rgba(5, 10, 24, 0)");
  context.fillStyle = seamGrad;
  context.fillRect(image.width - 250, 0, 750, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function makeGlowTexture(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.10, "rgba(220, 248, 255, 0.80)");
  gradient.addColorStop(0.30, "rgba(170, 228, 248, 0.30)");
  gradient.addColorStop(0.55, "rgba(130, 223, 255, 0.08)");
  gradient.addColorStop(1, "rgba(130, 223, 255, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeStarParticleTexture(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.18, "rgba(240, 250, 255, 0.72)");
  gradient.addColorStop(0.40, "rgba(200, 235, 250, 0.28)");
  gradient.addColorStop(0.65, "rgba(180, 225, 245, 0.08)");
  gradient.addColorStop(1, "rgba(180, 225, 245, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeInkStarTexture(THREE) {
  const size = 128;
  const center = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const rng = createSeededRng(509);

  context.clearRect(0, 0, size, size);

  const coreGradient = context.createRadialGradient(center, center, 0, center, center, 56);
  coreGradient.addColorStop(0, "rgba(248, 254, 255, 0.95)");
  coreGradient.addColorStop(0.22, "rgba(176, 235, 248, 0.72)");
  coreGradient.addColorStop(0.58, "rgba(78, 160, 190, 0.34)");
  coreGradient.addColorStop(1, "rgba(18, 46, 62, 0)");
  context.fillStyle = coreGradient;
  context.fillRect(0, 0, size, size);

  context.save();
  context.globalCompositeOperation = "screen";
  for (let wash = 0; wash < 9; wash += 1) {
    const x = center + (rng() - 0.5) * 30;
    const y = center + (rng() - 0.5) * 30;
    const radius = 16 + rng() * 28;
    const alpha = 0.08 + rng() * 0.12;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(220, 248, 255, ${alpha})`);
    gradient.addColorStop(1, "rgba(120, 206, 230, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-over";
  context.strokeStyle = "rgba(9, 35, 48, 0.42)";
  context.lineWidth = 2.1;
  context.beginPath();
  for (let point = 0; point <= 28; point += 1) {
    const angle = (point / 28) * Math.PI * 2;
    const radius = 31 + Math.sin(point * 1.7) * 3.4 + (rng() - 0.5) * 5;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius * 0.86;
    if (point === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
  context.stroke();

  context.strokeStyle = "rgba(186, 238, 248, 0.32)";
  context.lineWidth = 1.2;
  for (let arc = 0; arc < 4; arc += 1) {
    context.beginPath();
    context.ellipse(
      center + (rng() - 0.5) * 8,
      center + (rng() - 0.5) * 8,
      28 + rng() * 9,
      11 + rng() * 5,
      -0.34 + rng() * 0.68,
      Math.PI * (0.08 + rng() * 0.12),
      Math.PI * (1.15 + rng() * 0.65),
    );
    context.stroke();
  }
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSmoothPath(THREE, sceneStars) {
  const points = sceneStars.map((star) => vectorFromPosition(THREE, star.position));
  const first = points[0] ?? new THREE.Vector3(0, 0, 2.4);
  const last = points[points.length - 1] ?? new THREE.Vector3(0, 0, -2.8);

  return new THREE.CatmullRomCurve3(
    [
      first.clone().add(new THREE.Vector3(-0.9, -0.12, 0.95)),
      ...points,
      last.clone().add(new THREE.Vector3(0.9, 0.18, -0.95)),
    ],
    false,
    "catmullrom",
    0.42,
  );
}

function createRoadRibbon(THREE, curve, color, width, opacity, radialOffset = 0) {
  const samples = curve.getPoints(160);
  const vertices = [];
  const indices = [];

  for (let index = 0; index < samples.length; index += 1) {
    const point = samples[index];
    const next = samples[Math.min(index + 1, samples.length - 1)];
    const previous = samples[Math.max(index - 1, 0)];
    const tangent = next.clone().sub(previous).normalize();
    const side = new THREE.Vector3(-tangent.z, 0.18 + radialOffset, tangent.x).normalize();
    const breath = Math.sin(index * 0.16 + radialOffset * 8) * width * 0.2;
    const left = point.clone().add(side.clone().multiplyScalar(width + breath));
    const right = point.clone().add(side.clone().multiplyScalar(-width + breath));

    vertices.push(left.x, left.y, left.z, right.x, right.y, right.z);

    if (index < samples.length - 1) {
      const base = index * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function createInkRoadStrands(THREE, curve, theme) {
  const group = new THREE.Group();
  const iceColor = rgbToColor(theme.iceStrong, 0xb9f1ff);
  const goldColor = rgbToColor(theme.gold, 0xd8b86a);

  for (let lane = -2; lane <= 2; lane += 1) {
    for (let segment = 0; segment < 6; segment += 1) {
      const start = 0.03 + segment * 0.16 + ((lane * 13 + segment * 7) % 9) * 0.002;
      const end = Math.min(0.98, start + 0.08 + ((segment * 11 + lane * 5) % 10) * 0.008);
      const points = [];

      for (let index = 0; index <= 18; index += 1) {
        const localT = index / 18;
        const t = start + (end - start) * localT;
        const point = curve.getPoint(t);
        const tangent = curve.getTangent(t).normalize();
        const side = new THREE.Vector3(-tangent.z, 0.10, tangent.x).normalize();
        const wave = Math.sin(t * Math.PI * 8.8 + lane * 0.72 + segment) * 0.024;
        const lift = Math.sin(localT * Math.PI) * (0.006 + Math.abs(lane) * 0.002);
        const offset = side.multiplyScalar(lane * 0.028 + wave);
        points.push(point.clone().add(offset).add(new THREE.Vector3(0, lift, 0)));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
          color: lane === 2 && segment % 3 === 0 ? goldColor : iceColor,
          transparent: true,
          opacity: lane === 0 ? 0.12 : 0.038,
          depthWrite: false,
          blending: THREE.NormalBlending,
        }),
      );
      group.add(line);
    }
  }

  return group;
}

function createInkTrail(THREE, curve, theme, texture) {
  const count = 260;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const iceColor = new THREE.Color(rgbToColor(theme.iceStrong, 0xb9f1ff));
  const goldColor = new THREE.Color(rgbToColor(theme.gold, 0xd8b86a));

  for (let index = 0; index < count; index += 1) {
    const t = index / Math.max(1, count - 1);
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3(-tangent.z, 0.2, tangent.x).normalize();
    const lift = new THREE.Vector3(0, 1, 0);
    const wave = Math.sin(index * 1.71) * 0.5 + Math.cos(index * 0.37) * 0.5;
    const width = 0.05 + Math.sin(t * Math.PI) * 0.42;
    const looseness = 0.04 + ((index * 13) % 100) / 100 * width;
    const offset = side
      .clone()
      .multiplyScalar(wave * looseness)
      .add(lift.clone().multiplyScalar((Math.sin(index * 0.63) * 0.5 + 0.5) * 0.13 - 0.05));

    positions[index * 3] = point.x + offset.x;
    positions[index * 3 + 1] = point.y + offset.y;
    positions[index * 3 + 2] = point.z + offset.z;

    const color = index % 17 === 0 ? goldColor : iceColor;
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
    sizes[index] = 0.018 + ((index * 19) % 100) / 100 * 0.042;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      map: texture,
      size: 0.03,
      transparent: true,
      opacity: 0.26,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

/**
 * Flowing star river — 3 layers of particles for depth and brightness.
 * Returns { forePoints, midPoints, bkgPoints, update(time) }.
 */
function createStarRiver(THREE, curve, theme, particleTexture) {
  const iceColor = new THREE.Color(rgbToColor(theme.iceStrong, 0xb9f1ff));
  const iceDim = new THREE.Color(rgbToColor(theme.ice, 0x82dfff));
  const goldColor = new THREE.Color(rgbToColor(theme.gold, 0xd8b86a));

  const riverProfile = STRONG_HERO_VISUAL_PROFILE.starRiver;
  const layers = [
    {
      name: "fore",
      count: riverProfile.foreground.count,
      size: riverProfile.foreground.size,
      opacity: riverProfile.foreground.opacity,
      speedBase: 0.000055,
      warmRatio: 0.16,
      lateralSpread: 0.62,
    },
    {
      name: "mid",
      count: riverProfile.mid.count,
      size: riverProfile.mid.size,
      opacity: riverProfile.mid.opacity,
      speedBase: 0.000075,
      warmRatio: 0.09,
      lateralSpread: 0.78,
    },
    {
      name: "bkg",
      count: riverProfile.background.count,
      size: riverProfile.background.size,
      opacity: riverProfile.background.opacity,
      speedBase: 0.000105,
      warmRatio: 0.045,
      lateralSpread: 1.08,
    },
  ];

  const result = {};
  const allParticles = [];

  for (const cfg of layers) {
    const positions = new Float32Array(cfg.count * 3);
    const colors = new Float32Array(cfg.count * 3);
    const particles = [];

    for (let i = 0; i < cfg.count; i++) {
      const t = i / cfg.count;
      const lateral = (Math.sin(i * 1.37 + cfg.name.charCodeAt(0)) * 0.3 + Math.sin(i * 0.59 + cfg.name.charCodeAt(1)) * 0.2) * cfg.lateralSpread;
      const vertical = (Math.sin(i * 2.13 + cfg.name.charCodeAt(2)) * 0.06 + Math.cos(i * 0.73) * 0.04) * 0.6;
      const speed = cfg.speedBase * (0.5 + Math.abs(Math.sin(i * 0.47)) * 0.8);
      const warm = i % Math.max(1, Math.round(1 / cfg.warmRatio)) === 0;
      particles.push({ t, lateral, vertical, speed, warm });
    }

    function makeUpdateFn(ps, posArr, colArr, layerIdx) {
      return function(time) {
        for (let i = 0; i < ps.length; i++) {
          const p = ps[i];
          p.t = (p.t + p.speed) % 1.0;
          const point = curve.getPoint(p.t);
          const tangent = curve.getTangent(p.t).normalize();
          const side = new THREE.Vector3(-tangent.z, 0.08, tangent.x).normalize();
          const widthFactor = 0.3 + Math.sin(p.t * Math.PI) * 0.45;
          const lateralOffset = side.clone().multiplyScalar(p.lateral * widthFactor * 0.4);
          const drift = Math.sin(time * 0.0003 + i * 0.5 + layerIdx) * 0.04 * (1 + layerIdx * 0.3);

          posArr[i * 3] = point.x + lateralOffset.x + drift;
          posArr[i * 3 + 1] = point.y + p.vertical + Math.sin(time * 0.0002 + i + layerIdx) * 0.03;
          posArr[i * 3 + 2] = point.z + lateralOffset.z + drift * 0.5;

          const color = p.warm ? goldColor : (layerIdx === 0 ? iceColor : iceDim);
          const brightness = 0.5 + 0.5 * (1 - Math.abs(p.t - 0.5) * 0.6);
          colArr[i * 3] = color.r * brightness;
          colArr[i * 3 + 1] = color.g * brightness;
          colArr[i * 3 + 2] = color.b * brightness;
        }
      };
    }

    const updateFn = makeUpdateFn(particles, positions, colors, layers.indexOf(cfg));
    updateFn(0);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map: particleTexture,
        size: cfg.size,
        transparent: true,
        opacity: cfg.opacity,
        vertexColors: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );

    result[cfg.name] = { points, updateFn };
    allParticles.push({ points, geometry, updateFn, particles, cfg });
  }

  let lastTime = 0;
  function updateAll(time) {
    const dt = time - lastTime;
    lastTime = time;
    if (dt > 100 || dt < 0) return;
    for (const p of allParticles) {
      p.updateFn(time);
      p.geometry.attributes.position.needsUpdate = true;
      p.geometry.attributes.color.needsUpdate = true;
    }
  }

  return { fore: result.fore, mid: result.mid, bkg: result.bkg, update: updateAll };
}

function createDepthBeacons(THREE, sceneStars, theme, glowTexture) {
  const beaconGroup = new THREE.Group();
  const iceColor = rgbToColor(theme.iceStrong, 0xb9f1ff);
  const goldColor = rgbToColor(theme.gold, 0xd8b86a);

  for (const [index, star] of sceneStars.entries()) {
    const position = vectorFromPosition(THREE, star.position);
    const anchor = new THREE.Group();
    anchor.position.copy(position);

    const ringPoints = [];
    const ringRadius = star.current ? 0.19 : 0.15;
    for (let step = 0; step < 72; step += 1) {
      const angle = (step / 72) * Math.PI * 2;
      ringPoints.push(new THREE.Vector3(
        Math.cos(angle) * ringRadius,
        Math.sin(angle) * ringRadius * 0.28,
        Math.sin(angle) * ringRadius * 0.08,
      ));
    }
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(ringPoints),
      new THREE.LineBasicMaterial({
        color: index % 2 === 0 ? iceColor : goldColor,
        transparent: true,
        opacity: star.current ? 0.18 : 0.09,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.rotation.set(Math.PI * 0.42, 0.28 + index * 0.5, 0.24);
    anchor.add(ring);

    const vertical = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -0.02, 0),
        new THREE.Vector3(0, -0.24, 0),
      ]),
      new THREE.LineBasicMaterial({
        color: iceColor,
        transparent: true,
        opacity: star.current ? 0.03 : 0.015,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    anchor.add(vertical);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: star.current ? iceColor : goldColor,
        transparent: true,
        opacity: star.current ? 0.05 : 0.025,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.scale.setScalar(star.current ? 0.58 : 0.38);
    anchor.add(glow);

    beaconGroup.add(anchor);
  }

  return beaconGroup;
}

function createSceneShell(THREE, scene, backdropTexture) {
  const shellGroup = new THREE.Group();
  const shellGeometry = new THREE.CylinderGeometry(12, 12, 40, 96, 1, true);
  const backdrop = new THREE.Mesh(
    shellGeometry,
    new THREE.MeshBasicMaterial({
      map: backdropTexture,
      color: 0xd7f4ff,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
    }),
  );
  backdrop.rotation.y = -1.02;
  shellGroup.add(backdrop);

  scene.add(shellGroup);
  return shellGroup;
}

function createWorldGroup(THREE, scene) {
  const group = new THREE.Group();
  scene.add(group);
  return group;
}

function createDustField(THREE, texture, theme, particleCount = 280, spread = 1.0, baseOpacity = 0.34, particleSize = 0.042) {
  const count = particleCount;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const iceColor = new THREE.Color(rgbToColor(theme.iceStrong, 0xb9f1ff));
  const goldColor = new THREE.Color(rgbToColor(theme.gold, 0xd8b86a));

  for (let index = 0; index < count; index += 1) {
    const radius = (4.8 + ((index * 17) % 42) / 10) * spread;
    const theta = index * 2.399963;
    const y = (-2.7 + ((index * 29) % 540) / 100) * spread;
    positions[index * 3] = (Math.cos(theta) * radius + Math.sin(index * 0.41) * 1.5) * spread;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = (Math.sin(theta) * radius - 2.2 + Math.cos(index * 0.23) * 1.6) * spread;

    const color = index % 19 === 0 ? goldColor : iceColor;
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      map: texture,
      size: particleSize,
      transparent: true,
      opacity: baseOpacity,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function makeInkWashTexture(THREE) {
  // Seeded PRNG for deterministic output
  let s = 42;
  function rng() {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0x100000000;
  }

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  // Base transparent
  context.clearRect(0, 0, size, size);

  // Draw many soft overlapping blobs to simulate ink diffusion
  const blobCount = 36;
  for (let i = 0; i < blobCount; i++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const r = 58 + rng() * 190;
    const opacity = 0.075 + rng() * 0.16;

    // Slight color variation: cold white to pale blue
    const tint = rng();
    const br = 200 + Math.floor(tint * 55);
    const bg = 220 + Math.floor(tint * 35);
    const bb = 255;

    const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, r);
    gradient.addColorStop(0, `rgba(${br}, ${bg}, ${bb}, ${opacity})`);
    gradient.addColorStop(0.3, `rgba(${br}, ${bg}, ${bb}, ${opacity * 0.6})`);
    gradient.addColorStop(0.6, `rgba(${br - 20}, ${bg - 10}, ${bb}, ${opacity * 0.2})`);
    gradient.addColorStop(1, `rgba(${br - 40}, ${bg - 20}, ${bb - 10}, 0)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  // Add very subtle "paper texture" grain - few sparse darker spots
  for (let i = 0; i < 60; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r2 = 2 + rng() * 12;
    const alpha = 0.01 + rng() * 0.02;
    const gradient = context.createRadialGradient(x, y, 0, x, y, r2);
    gradient.addColorStop(0, `rgba(180, 210, 240, ${alpha})`);
    gradient.addColorStop(1, "rgba(180, 210, 240, 0)");
    context.fillStyle = gradient;
    context.fillRect(x - r2, y - r2, r2 * 2, r2 * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createInkWashMist(THREE, curve, theme, texture) {
  // Seeded PRNG for deterministic output
  let s = 137;
  function rng() {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0x100000000;
  }

  const group = new THREE.Group();
  const count = 12;
  const iceColor = rgbToColor(theme.iceStrong, 0xb9f1ff);

  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3(-tangent.z, 0.15, tangent.x).normalize();

    // Alternate between left and right of the curve, with deterministic variation
    const det = rng();
    const sideSign = (i % 2 === 0 ? 1 : -1) * (0.4 + det * 0.8);
    const liftOffset = (rng() - 0.5) * 0.6;
    const spread = 0.3 + rng() * 0.8;

    const offset = side.clone().multiplyScalar(sideSign * spread);
    offset.y += liftOffset;

    const mist = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        color: iceColor,
        transparent: true,
        opacity: 0.014 + rng() * 0.018,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    );
    mist.position.set(
      point.x + offset.x,
      point.y + offset.y + 0.1,
      point.z + offset.z,
    );

    // Scale: larger near middle of the curve, smaller at ends
    const midFactor = Math.sin(t * Math.PI);
    const baseScale = 1.05 + midFactor * 1.5;
    mist.scale.setScalar(baseScale * (0.7 + rng() * 0.6));
    mist.material.rotation = rng() * Math.PI * 2;

    group.add(mist);
  }

  // Add a few larger, more transparent mist clouds above the path
  for (let i = 0; i < 3; i++) {
    const t = 0.15 + rng() * 0.7;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3(-tangent.z, 0.3, tangent.x).normalize();

    const offset = side.clone().multiplyScalar((rng() - 0.5) * 1.6);
    offset.y += 0.3 + rng() * 0.5;

    const mist = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        color: iceColor,
        transparent: true,
        opacity: 0.012 + rng() * 0.014,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    );
    mist.position.set(
      point.x + offset.x,
      point.y + offset.y,
      point.z + offset.z,
    );
    mist.scale.setScalar(2.2 + rng() * 1.6);
    mist.material.rotation = rng() * Math.PI * 2;

    group.add(mist);
  }

  return group;
}

function createStarMesh(THREE, star, theme, glowTexture, starTexture) {
  const heroProfile = STRONG_HERO_VISUAL_PROFILE.currentStar;
  const color = star.current
    ? rgbToColor(theme.iceStrong, 0xb9f1ff)
    : rgbToColor(theme.ice, 0x82dfff);
  const core = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: starTexture,
      color,
      transparent: true,
      opacity: star.current ? 0.92 : 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  core.position.copy(vectorFromPosition(THREE, star.position));
  core.userData.baseScale = star.current
    ? star.radius * heroProfile.coreScaleMultiplier
    : star.radius * 2.45;
  core.userData.star = star;
  core.scale.setScalar(core.userData.baseScale);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity: star.current ? heroProfile.haloOpacity : 0.05,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.position.copy(core.position);
  halo.scale.setScalar(star.current ? heroProfile.haloScale : 0.24);
  halo.userData.follow = core;

  const hitArea = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(0.34, star.radius * 2.4), 24, 12),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  hitArea.position.copy(core.position);
  hitArea.userData.star = star;

  let orbitRing = null;
  if (star.current) {
    orbitRing = new THREE.Mesh(
      new THREE.RingGeometry(star.radius * 2.25, star.radius * 2.6, 64),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: heroProfile.orbitRingOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    orbitRing.position.copy(core.position);
    orbitRing.rotation.x = Math.PI * 0.34;
    orbitRing.rotation.y = Math.PI * 0.16;
  }

  return { core, halo, hitArea, orbitRing };
}

function createYearLabel(THREE, star) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "500 28px Microsoft YaHei UI, Arial, sans-serif";
  context.fillStyle = "rgba(226, 244, 255, 0.92)";
  context.fillText(String(star.year), 12, 36);
  context.font = "400 16px Microsoft YaHei UI, Arial, sans-serif";
  context.fillStyle = "rgba(185, 241, 255, 0.62)";
  context.fillText(star.type, 12, 58);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: star.current ? 0.46 : 0.28,
      depthWrite: false,
    }),
  );
  label.position.copy(vectorFromPosition(THREE, star.position));
  label.position.x += 0.20;
  label.position.y += 0.12;
  label.scale.set(0.52, 0.20, 1);
  return label;
}

export async function createStarField({
  canvas,
  layout,
  onSelect,
  onEnterRoad,
  intro,
}) {
  const THREE = await loadThree();
  const media = window.matchMedia(MOBILE_QUERY);
  const theme = readCanvasTheme();
  const sceneLayout = createSceneStarLayout(layout.stars);
  const sourceBackdropTexture = await loadTexture(THREE, BACKDROP_URL);
  const backdropTexture = makeNaturalBackdropTexture(THREE, sourceBackdropTexture);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02040b, 0.015);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x02040b, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 28);

  const glowTexture = makeGlowTexture(THREE);
  const particleTexture = makeStarParticleTexture(THREE);
  const starTexture = makeInkStarTexture(THREE);
  const inkTexture = makeInkWashTexture(THREE);
  const worldGroup = createWorldGroup(THREE, scene);
  scene.background = backdropTexture;
  const dustField = createDustField(THREE, particleTexture, theme, 480, 1.0, 0.40, 0.045);
  worldGroup.add(dustField);
  const deepField = createDustField(THREE, particleTexture, theme, 320, 1.8, 0.18, 0.035);
  deepField.position.z = -2;
  worldGroup.add(deepField);

  scene.add(new THREE.AmbientLight(0x9bdff6, 0.85));
  const keyLight = new THREE.PointLight(0xb9f1ff, 2.0, 10);
  keyLight.position.set(-1.4, 1.6, 3.4);
  scene.add(keyLight);

  const roadGroup = new THREE.Group();
  const pathCurve = createSmoothPath(THREE, sceneLayout.sceneStars);
  // Star river: 3-layer flowing particles (foreground bright, mid, background dust)
  const starRiver = createStarRiver(THREE, pathCurve, theme, particleTexture);
  roadGroup.add(starRiver.bkg.points);
  roadGroup.add(starRiver.mid.points);
  roadGroup.add(starRiver.fore.points);
  // Ink-wash mist layer: semi-transparent cloud sprites along the path
  const inkMist = createInkWashMist(THREE, pathCurve, theme, inkTexture);
  roadGroup.add(inkMist);
  roadGroup.add(createInkTrail(THREE, pathCurve, theme, particleTexture));
  roadGroup.add(createDepthBeacons(THREE, sceneLayout.sceneStars, theme, glowTexture));

  const selectableMeshes = [];
  const starObjects = new Map();
  for (const star of sceneLayout.sceneStars) {
    const { core, halo, hitArea, orbitRing } = createStarMesh(THREE, star, theme, glowTexture, starTexture);
    const label = createYearLabel(THREE, star);
    roadGroup.add(halo, core, label, hitArea);
    if (orbitRing) {
      roadGroup.add(orbitRing);
    }
    selectableMeshes.push(hitArea);
    starObjects.set(star.id, {
      core, halo, hitArea, label, orbitRing, star,
      twinklePhase: (star.depth * 2.71 + 1.3) % (Math.PI * 2),
      twinkleSpeed: 0.6 + (star.depth * 0.17) % 1.2,
    });
  }
  worldGroup.add(roadGroup);

  // floating constellation removed — artificial geometry doesn't fit the cosmic theme

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const state = {
    activeStarId: null,
    hoveredStarId: null,
    enteredRoad: false,
    pointerStart: { x: 0, y: 0 },
    disposed: false,
  };

  function isMobile() {
    return media.matches;
  }

  function enterRoad() {
    if (state.enteredRoad) {
      return;
    }

    state.enteredRoad = true;
    onEnterRoad?.();
  }

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.fov = isMobile() ? 58 : 48;
    camera.updateProjectionMatrix();
  }

  function normalizedPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    return { x, y };
  }

  function pickStar(event) {
    const point = normalizedPointer(event);
    pointer.set(point.x, point.y);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(selectableMeshes, false);
    const hitStar = hits[0]?.object?.userData?.star;

    if (hitStar) {
      return hitStar;
    }

    const rect = canvas.getBoundingClientRect();
    let nearest = null;
    let nearestDistance = Infinity;

    for (const { core, star } of starObjects.values()) {
      const projected = core.getWorldPosition(new THREE.Vector3()).project(camera);

      if (projected.z < -1 || projected.z > 1) {
        continue;
      }

      const screenX = (projected.x * 0.5 + 0.5) * rect.width + rect.left;
      const screenY = (-projected.y * 0.5 + 0.5) * rect.height + rect.top;
      const distance = Math.hypot(event.clientX - screenX, event.clientY - screenY);

      if (distance < nearestDistance) {
        nearest = star;
        nearestDistance = distance;
      }
    }

    return nearestDistance <= (isMobile() ? 86 : 72) ? nearest : null;
  }

  function updateDebugTargets() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const targets = [];

    for (const { core, star } of starObjects.values()) {
      const worldPos = core.getWorldPosition(new THREE.Vector3());
      const projected = worldPos.project(camera);

      if (projected.z < -1 || projected.z > 1) {
        continue;
      }

      targets.push({
        id: star.id,
        title: star.title,
        x: Math.round((projected.x * 0.5 + 0.5) * rect.width + rect.left),
        y: Math.round((-projected.y * 0.5 + 0.5) * rect.height + rect.top),
      });
    }

    window.__starRoadDebug = { targets, timestamp: Date.now() };
  }

  function updateHover(event) {
    const star = pickStar(event);
    state.hoveredStarId = star?.id ?? null;
    canvas.style.cursor = star ? "pointer" : "crosshair";
    return star;
  }

  function focusStar(star) {
    if (!star) {
      return;
    }

    enterRoad();
    state.activeStarId = star.id;
    window.setTimeout(() => onSelect?.(star), 130);
  }

  function resetCamera() {
    state.activeStarId = null;
    enterRoad();
  }

  function onPointerDown(event) {
    enterRoad();
    state.pointerStart = { x: event.clientX, y: event.clientY };
    runtime.requestHandoff();
  }

  function onPointerMove(event) {
    updateHover(event);
  }

  function onPointerUp(event) {
    const moved = Math.hypot(
      event.clientX - state.pointerStart.x,
      event.clientY - state.pointerStart.y,
    );
    const star = updateHover(event);
    if (moved < 5 && star) {
      focusStar(star);
    }
  }

  function animateScene(time = 0) {
    dustField.rotation.y = time / 42000;
    dustField.rotation.x = Math.sin(time / 15000) * 0.018;
    deepField.rotation.y = time / 62000 + 0.5;
    deepField.rotation.x = Math.sin(time / 20000) * 0.025;
    roadGroup.rotation.y = Math.sin(time / 9000) * 0.018;
    starRiver.update(time);
    inkMist.position.y = Math.sin(time / 6000) * 0.04;
    inkMist.position.x = Math.sin(time / 8000) * 0.03;
    inkMist.scale.setScalar(1 + Math.sin(time / 4500) * 0.04);
    // floating constellation animation removed

    for (const { core, halo, label, orbitRing, star, twinklePhase, twinkleSpeed } of starObjects.values()) {
      const isActive = state.activeStarId === star.id;
      const isHovered = state.hoveredStarId === star.id;
      const hasActive = state.activeStarId !== null;
      const heroProfile = STRONG_HERO_VISUAL_PROFILE.currentStar;
      const pulse = 1 + Math.sin(time / 1000 + star.depth * 0.8) * (star.current ? 0.06 : 0.035);
      const twinkle = 1 + Math.sin(time * twinkleSpeed / 800 + twinklePhase) * 0.10;
      const hoverScale = isHovered ? 1.1 : 1;
      const activeScale = isActive ? 1.04 : 1;
      const baseCoreScale = core.userData.baseScale ?? 1;
      core.scale.setScalar(baseCoreScale * pulse * hoverScale * activeScale);
      halo.scale.setScalar((star.current ? heroProfile.haloScale : 0.24) * pulse * twinkle * (isHovered || isActive ? 1.08 : 1));

      if (orbitRing) {
        orbitRing.rotation.z = time / 2800;
        orbitRing.material.opacity = isActive || isHovered
          ? heroProfile.orbitRingOpacity + 0.08
          : heroProfile.orbitRingOpacity;
      }

      // Dim non-focused stars when another is active
      if (hasActive) {
        halo.material.opacity = isActive ? heroProfile.haloOpacity : isHovered ? 0.06 : 0.025;
        label.material.opacity = isActive ? 0.48 : 0.025;
      } else {
        halo.material.opacity = star.current ? heroProfile.haloOpacity : isHovered ? 0.08 : 0.05;
        label.material.opacity = isHovered || isActive || star.current ? 0.46 : 0.24;
      }
    }

    updateDebugTargets();
  }

  let runtime;
  const inputRouter = createInputRouter({
    target: canvas,
    getViewport: () => ({
      width: canvas.clientWidth || window.innerWidth,
      height: canvas.clientHeight || window.innerHeight,
    }),
    onInput: () => runtime?.requestHandoff(),
  });
  const initialQuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0.18, -0.06, 0, "YXZ"),
  );
  runtime = createUniverseRuntime({
    THREE,
    canvas,
    camera,
    scene,
    renderer,
    intro,
    inputRouter,
    initialFlightState: createFlightState({
      position: { x: -0.2, y: 1.14, z: 5.1 },
      quaternion: {
        x: initialQuaternion.x,
        y: initialQuaternion.y,
        z: initialQuaternion.z,
        w: initialQuaternion.w,
      },
    }),
    onFrame: animateScene,
    onError: (error) => console.error(error),
  });

  function destroy() {
    if (state.disposed) return;
    state.disposed = true;
    runtime.destroy();
    window.removeEventListener("resize", resize);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    renderer.dispose();
  }

  window.addEventListener("resize", resize);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  resize();
  runtime.start();

  return {
    ...runtime,
    destroy,
    focusStar,
    resetCamera,
  };
}
