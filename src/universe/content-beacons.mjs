import { INK_COLOR_GRADE } from "./ink-color-grade.mjs";

const BEACON_TIERS = Object.freeze({
  core: {
    glowSize: 0.22,
    glowOpacity: 0.72,
    glowColor: INK_COLOR_GRADE.goldGlint,
    ringSize: 0.48,
    ringOpacity: 0.28,
    ringColor: INK_COLOR_GRADE.goldGlint,
    labelAlways: true,
    labelOpacity: 0.72,
    hitRadius: 38,
  },
  key: {
    glowSize: 0.14,
    glowOpacity: 0.48,
    glowColor: INK_COLOR_GRADE.riverSilver,
    ringSize: 0.32,
    ringOpacity: 0.14,
    ringColor: INK_COLOR_GRADE.riverSilver,
    labelAlways: false,
    labelOpacity: 0.38,
    hitRadius: 28,
  },
  field: {
    glowSize: 0.09,
    glowOpacity: 0.3,
    glowColor: INK_COLOR_GRADE.vortexTeal,
    ringSize: 0,
    ringOpacity: 0,
    ringColor: INK_COLOR_GRADE.riverSilver,
    labelAlways: false,
    labelOpacity: 0.18,
    hitRadius: 20,
  },
});

function beaconTier(star) {
  if (star.current) return "core";
  if (star.type === "milestone" || (star.importance && star.importance > 0.6)) return "key";
  return "field";
}

function makeGlowTexture(THREE) {
  const size = 128;
  const half = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.06, "rgba(255,254,248,0.9)");
  gradient.addColorStop(0.22, "rgba(210,238,248,0.44)");
  gradient.addColorStop(0.48, "rgba(140,210,230,0.08)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function makeRingTexture(THREE) {
  const size = 128;
  const half = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(half, half, half - 6, (half - 6) * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Outer faded ring
  ctx.strokeStyle = "rgba(200,230,240,0.14)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(half, half, half - 12, (half - 12) * 0.38, 0.12, 0, Math.PI * 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function makeLabelTexture(THREE, text) {
  const width = 256;
  const height = 72;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "rgba(210,232,225,0.78)";
  ctx.font = '26px "Inter", "Microsoft YaHei UI", "PingFang SC", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(text), width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createContentBeacons({ THREE, layout }) {
  const group = new THREE.Group();
  group.name = "ContentBeacons";

  const glowTexture = makeGlowTexture(THREE);
  const ringTexture = makeRingTexture(THREE);

  const beaconDefs = [];

  const stars = Array.isArray(layout.sceneStars) ? layout.sceneStars : (Array.isArray(layout.stars) ? layout.stars : []);
  for (const star of stars) {
    const tier = beaconTier(star);
    const cfg = BEACON_TIERS[tier];

    const beaconGroup = new THREE.Group();
    beaconGroup.position.set(star.position.x, star.position.y, star.position.z);
    beaconGroup.name = `beacon-${star.id}`;

    // Glow core
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: cfg.glowColor,
      transparent: true,
      opacity: cfg.glowOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Sprite(glowMaterial);
    glow.scale.set(cfg.glowSize, cfg.glowSize, 1);
    glow.name = "glow";

    // Ring (current node only)
    const ringMaterial = new THREE.SpriteMaterial({
      map: ringTexture,
      color: cfg.ringColor,
      transparent: true,
      opacity: cfg.ringOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Sprite(ringMaterial);
    ring.scale.set(cfg.ringSize, cfg.ringSize, 1);
    ring.name = "ring";
    ring.visible = cfg.ringOpacity > 0;

    // Year label
    const labelTexture = makeLabelTexture(THREE, String(star.year ?? "·"));
    const labelMaterial = new THREE.SpriteMaterial({
      map: labelTexture,
      transparent: true,
      opacity: cfg.labelOpacity,
      depthWrite: false,
      depthTest: true,
    });
    const label = new THREE.Sprite(labelMaterial);
    const labelW = cfg.glowSize * 3.4;
    const labelH = labelW * 0.28;
    label.scale.set(labelW, labelH, 1);
    label.position.y = cfg.glowSize * 1.5;
    label.name = "label";
    label.visible = cfg.labelAlways;

    beaconGroup.add(glow, ring, label);
    group.add(beaconGroup);

    beaconDefs.push({
      star,
      tier,
      cfg,
      group: beaconGroup,
      glow,
      ring,
      label,
      hovered: false,
      visited: false,
    });
  }

  const _v3 = new THREE.Vector3();

  function hitTest(camera, viewport, pointerX, pointerY) {
    const cx = pointerX ?? (viewport.width / 2);
    const cy = pointerY ?? (viewport.height / 2);
    let closest = null;
    let closestDist = Infinity;

    for (const def of beaconDefs) {
      def.group.getWorldPosition(_v3);
      const projected = _v3.clone().project(camera);
      if (projected.z > 1 || projected.z < -1) continue;

      const sx = (projected.x * 0.5 + 0.5) * viewport.width;
      const sy = (-projected.y * 0.5 + 0.5) * viewport.height;
      const dist = Math.hypot(cx - sx, cy - sy);

      if (dist < def.cfg.hitRadius && dist < closestDist) {
        closest = def;
        closestDist = dist;
      }
    }

    return closest;
  }

  function applyHover(hoveredDef) {
    for (const def of beaconDefs) {
      const active = def === hoveredDef;
      if (def.hovered === active) continue;
      def.hovered = active;

      const scale = active ? 1.45 : 1;
      def.glow.scale.set(def.cfg.glowSize * scale, def.cfg.glowSize * scale, 1);
      def.glow.material.opacity = active
        ? Math.min(0.92, def.cfg.glowOpacity * 1.6)
        : def.cfg.glowOpacity;

      if (def.tier !== "core") {
        def.label.visible = active;
        def.label.material.opacity = active ? 0.56 : def.cfg.labelOpacity;
      }
    }
  }

  function getDefByStarId(id) {
    return beaconDefs.find((d) => d.star.id === id || d.star.file === id);
  }

  function markVisited(id) {
    const def = getDefByStarId(id);
    if (def && !def.visited) {
      def.visited = true;
    }
  }

  function update(time, _camera, experience) {
    const userActive = experience && (experience.mode === "active" || experience.mode === "handoff");
    for (const def of beaconDefs) {
      const pulse = 1 + Math.sin(time * 0.0009 + def.star.position.x * 1.7) * 0.05;
      if (!def.hovered) {
        const visitedScale = def.visited ? 1.06 : 1;
        def.glow.scale.set(
          def.cfg.glowSize * pulse * visitedScale,
          def.cfg.glowSize * pulse * visitedScale,
          1,
        );
      }
      // 已访问星标：基辉光提升（微光常亮）
      if (def.visited) {
        def.glow.material.opacity = def.hovered
          ? Math.min(0.92, def.cfg.glowOpacity * 1.6)
          : Math.min(0.92, def.cfg.glowOpacity * 1.35);
      }
      // Fade labels when user is actively flying (reduce visual clutter)
      if (def.tier === "core" && def.cfg.labelAlways && !def.hovered) {
        def.label.material.opacity = userActive ? def.cfg.labelOpacity * 0.5 : def.cfg.labelOpacity;
      }
    }
  }

  function dispose() {
    const textures = new Set();
    for (const def of beaconDefs) {
      for (const key of ["glow", "ring", "label"]) {
        const mat = def[key].material;
        if (mat.map && !textures.has(mat.map)) {
          textures.add(mat.map);
          mat.map.dispose();
        }
        mat.dispose();
      }
    }
    group.clear();
  }

  return {
    group,
    beaconDefs,
    hitTest,
    applyHover,
    getDefByStarId,
    markVisited,
    update,
    dispose,
  };
}
