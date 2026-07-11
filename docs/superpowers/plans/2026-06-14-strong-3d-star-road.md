# Strong 3D Star Road Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the first screen from a subtle dark star field into a high-impact 3D star road with a dominant current star, clear depth, and preserved Robin title readability.

**Architecture:** Keep the buildless static site architecture. Use tests to lock visual configuration contracts, then tune Three.js scene construction in `src/star-field.mjs`, camera/star positions in `src/star-layout.mjs`, and only the necessary overlay hierarchy in `styles.css`.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Three.js local module, Node built-in test runner, local Python static server.

---

## Files

- Modify: `tests/star-field-controls.test.mjs` - add visual profile tests for the stronger hero scene.
- Modify: `tests/star-layout.test.mjs` - add camera/layout tests that keep the current star prominent in the first viewport.
- Modify: `src/star-field.mjs` - expose and use stronger visual profiles; tune backdrop, star river, current star, foreground dust, and auto-rotation.
- Modify: `src/star-layout.mjs` - adjust scene positions and home camera focus so the current star is a first-screen anchor.
- Modify: `styles.css` - reduce overlay competition and preserve title readability over the stronger 3D scene.
- Optional Modify: `index.html` - update cache-busting query string only if browser cache blocks verification.

No git commits in this run unless Robin explicitly asks.

## Task 1: Lock Strong Visual Profile With Tests

**Files:**
- Modify: `tests/star-field-controls.test.mjs`
- Modify: `src/star-field.mjs`

- [ ] **Step 1: Add failing tests for the strong first-screen visual profile**

Append these tests to `tests/star-field-controls.test.mjs`:

```js
test("uses a strong current-star hero profile for first-screen impact", async () => {
  const module = await import(`../src/star-field.mjs?hero-profile=${Date.now()}`);
  const profile = module.getStrongHeroVisualProfile?.();

  assert.ok(profile);
  assert.ok(profile.currentStar.coreScaleMultiplier >= 4.2);
  assert.ok(profile.currentStar.haloScale >= 0.72);
  assert.ok(profile.currentStar.haloOpacity >= 0.18);
  assert.ok(profile.currentStar.orbitRingOpacity >= 0.16);
});

test("uses layered star-river particles for a readable road direction", async () => {
  const module = await import(`../src/star-field.mjs?river-profile=${Date.now()}`);
  const profile = module.getStrongHeroVisualProfile?.();

  assert.ok(profile.starRiver.foreground.count >= 140);
  assert.ok(profile.starRiver.mid.count >= 420);
  assert.ok(profile.starRiver.background.count >= 520);
  assert.ok(profile.starRiver.foreground.opacity > profile.starRiver.background.opacity);
});

test("keeps the background behind the title instead of competing with it", async () => {
  const module = await import(`../src/star-field.mjs?backdrop-balance=${Date.now()}`);
  const profile = module.getStrongHeroVisualProfile?.();

  assert.ok(profile.backdrop.sourceImageAlpha <= 0.52);
  assert.ok(profile.backdrop.leftTitleMaskOpacity >= 0.42);
  assert.ok(profile.backdrop.centerGlowOpacity >= 0.16);
});
```

- [ ] **Step 2: Run tests and confirm the new tests fail**

Run:

```powershell
node --test tests/star-field-controls.test.mjs
```

Expected result before implementation: FAIL because `getStrongHeroVisualProfile` is not exported.

- [ ] **Step 3: Add the visual profile export**

In `src/star-field.mjs`, define the profile near the existing visual constants:

```js
const STRONG_HERO_VISUAL_PROFILE = Object.freeze({
  currentStar: {
    coreScaleMultiplier: 4.6,
    haloScale: 0.82,
    haloOpacity: 0.22,
    orbitRingOpacity: 0.18,
  },
  starRiver: {
    foreground: { count: 160, size: 0.095, opacity: 0.95 },
    mid: { count: 460, size: 0.052, opacity: 0.68 },
    background: { count: 560, size: 0.026, opacity: 0.36 },
  },
  backdrop: {
    sourceImageAlpha: 0.48,
    leftTitleMaskOpacity: 0.48,
    centerGlowOpacity: 0.2,
  },
});

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
```

- [ ] **Step 4: Run profile tests**

Run:

```powershell
node --test tests/star-field-controls.test.mjs
```

Expected result: PASS.

## Task 2: Lock First-Screen Camera And Current-Star Layout

**Files:**
- Modify: `tests/star-layout.test.mjs`
- Modify: `src/star-layout.mjs`

- [ ] **Step 1: Add failing layout tests for a stronger current-star anchor**

Append these tests to `tests/star-layout.test.mjs`:

```js
test("anchors the current 3d star in the hero visual zone", () => {
  const layout = createStarLayout([
    star({ title: "Current", date: "2026-06-09", current: true }),
    star({ title: "Path", date: "2025-01-01" }),
    star({ title: "Origin", date: "2024-01-01" }),
  ]);
  const scene = createSceneStarLayout(layout.stars);
  const current = scene.sceneStars.find((item) => item.current);

  assert.ok(current.position.x >= 0.55);
  assert.ok(current.position.z >= 2.65);
  assert.ok(current.radius >= 0.085);
});

test("uses a desktop home focus that frames the current star and star road", () => {
  const layout = createStarLayout([
    star({ title: "Current", date: "2026-06-09", current: true }),
    star({ title: "Path", date: "2025-01-01" }),
    star({ title: "Origin", date: "2024-01-01" }),
  ]);
  const scene = createSceneStarLayout(layout.stars);

  assert.ok(scene.homeFocus.desktop.x >= 0.5);
  assert.ok(scene.homeFocus.desktop.z >= 1.9);
  assert.ok(scene.cameraLimits.maxDistance <= 8.8);
});
```

- [ ] **Step 2: Run layout tests and confirm failure**

Run:

```powershell
node --test tests/star-layout.test.mjs
```

Expected result before implementation: FAIL because the current star is not anchored far enough into the hero visual zone.

- [ ] **Step 3: Update scene star positions and home camera**

In `src/star-layout.mjs`, update `createSceneStarLayout` so the current star is prominent and the older stars trail into depth:

```js
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
      minZ: -5.65,
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
```

- [ ] **Step 4: Run all layout tests**

Run:

```powershell
node --test tests/star-layout.test.mjs
```

Expected result: PASS.

## Task 3: Apply Strong 3D Scene Tuning

**Files:**
- Modify: `src/star-field.mjs`

- [ ] **Step 1: Use the profile in backdrop rendering**

Inside `makeNaturalBackdropTexture`, replace hard-coded source image alpha with the profile value:

```js
const profile = STRONG_HERO_VISUAL_PROFILE;

context.save();
context.globalAlpha = profile.backdrop.sourceImageAlpha;
context.drawImage(image, 0, 0, image.width, height);
context.restore();
```

Add a title-side mask and center glow after the source image draw:

```js
const titleMask = context.createLinearGradient(0, 0, width * 0.42, 0);
titleMask.addColorStop(0, `rgba(2, 4, 11, ${profile.backdrop.leftTitleMaskOpacity})`);
titleMask.addColorStop(0.55, "rgba(2, 4, 11, 0.18)");
titleMask.addColorStop(1, "rgba(2, 4, 11, 0)");
context.fillStyle = titleMask;
context.fillRect(0, 0, width * 0.5, height);

const heroGlow = context.createRadialGradient(width * 0.48, height * 0.48, 0, width * 0.48, height * 0.48, width * 0.28);
heroGlow.addColorStop(0, `rgba(185, 241, 255, ${profile.backdrop.centerGlowOpacity})`);
heroGlow.addColorStop(0.42, "rgba(82, 159, 201, 0.08)");
heroGlow.addColorStop(1, "rgba(2, 4, 11, 0)");
context.fillStyle = heroGlow;
context.fillRect(0, 0, width, height);
```

- [ ] **Step 2: Use stronger star-river layer config**

In `createStarRiver`, replace the layer constants with values from `STRONG_HERO_VISUAL_PROFILE.starRiver`:

```js
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
```

- [ ] **Step 3: Strengthen current star and add orbit rings**

In `createStarMesh`, use the current-star profile:

```js
const heroProfile = STRONG_HERO_VISUAL_PROFILE.currentStar;
core.userData.baseScale = star.current
  ? star.radius * heroProfile.coreScaleMultiplier
  : star.radius * 2.45;

halo.scale.setScalar(star.current ? heroProfile.haloScale : 0.24);
halo.material.opacity = star.current ? heroProfile.haloOpacity : 0.05;
```

Create an optional ring for the current star and return it:

```js
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
```

When adding star objects in `createStarField`, add `orbitRing` only when present:

```js
const { core, halo, hitArea, orbitRing } = createStarMesh(THREE, star, theme, glowTexture, starTexture);
roadGroup.add(halo, core, label, hitArea);
if (orbitRing) {
  roadGroup.add(orbitRing);
}
```

Store `orbitRing` in `starObjects` and animate it:

```js
if (orbitRing) {
  orbitRing.rotation.z = time / 2800;
  orbitRing.material.opacity = isActive || isHovered ? 0.26 : 0.18;
}
```

- [ ] **Step 4: Reduce auto-rotation drift**

In `updateAutoRotation`, reduce passive movement so the main star stays framed:

```js
cameraState.baseYaw += deltaTime * 0.000014;
```

- [ ] **Step 5: Run star-field profile tests**

Run:

```powershell
node --test tests/star-field-controls.test.mjs
```

Expected result: PASS.

## Task 4: Preserve UI Readability Over The Stronger Scene

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Reduce competing page-level overlays**

In `.star-road-app`, keep the left readability mask but reduce center darkness:

```css
.star-road-app {
  background:
    linear-gradient(
      90deg,
      rgba(2, 4, 11, 0.88) 0%,
      rgba(2, 4, 11, 0.46) 28%,
      rgba(2, 4, 11, 0.02) 58%,
      rgba(2, 4, 11, 0.16) 100%
    ),
    linear-gradient(
      180deg,
      rgba(2, 4, 11, 0.12) 0%,
      rgba(2, 4, 11, 0.0) 44%,
      rgba(2, 4, 11, 0.34) 100%
    ),
    linear-gradient(145deg, #07111f 0%, #050914 44%, #02040b 100%);
}
```

- [ ] **Step 2: Lower decorative pseudo-element competition**

Update `.star-road-app::before` and `.star-road-app::after`:

```css
.star-road-app::before {
  opacity: 0.1;
}

.star-road-app::after {
  background:
    radial-gradient(
      ellipse at 54% 46%,
      rgba(184, 231, 245, 0.11),
      transparent 34%
    ),
    radial-gradient(
      ellipse at center,
      transparent 0%,
      rgba(0, 0, 0, 0.32) 88%
    );
}
```

- [ ] **Step 3: Keep title readable without overpowering the scene**

Update the title text shadows:

```css
.hero-title h1 {
  color: rgba(244, 250, 255, 0.96);
  text-shadow:
    0 0 30px rgba(2, 4, 11, 0.72),
    0 0 42px rgba(130, 223, 255, 0.18);
}

.hero-subtitle {
  color: rgba(226, 237, 255, 0.78);
  text-shadow: 0 0 22px rgba(2, 4, 11, 0.72);
}
```

- [ ] **Step 4: Manually verify title and canvas layer order**

Open:

```text
http://localhost:8788
```

Expected result: `Robin` remains readable, while the 3D scene behind it is stronger and less empty.

## Task 5: Full Verification

**Files:**
- No implementation files unless verification exposes a defect.

- [ ] **Step 1: Run all automated checks**

Run:

```powershell
node --test tests/star-content.test.mjs tests/star-layout.test.mjs tests/star-field-controls.test.mjs
node scripts/validate-content.mjs
```

Expected result:

```text
tests pass
Validated 3 public star nodes.
```

- [ ] **Step 2: Capture desktop screenshot**

Use the in-app browser or Playwright against:

```text
http://localhost:8788
```

Viewport target: desktop around `1440x900`.

Save screenshot to:

```text
output/playwright/strong-3d-desktop.png
```

Expected visual result:

- Current star is the brightest focal point.
- Star road direction is visible without explanation.
- Left title is readable.
- First screen is not mostly empty black.

- [ ] **Step 3: Capture mobile screenshot**

Use viewport around `390x844`.

Save screenshot to:

```text
output/playwright/strong-3d-mobile.png
```

Expected visual result:

- Robin title remains in the first screen.
- Current star and star road are visible.
- Compass button and bottom hint do not cover the main star.

- [ ] **Step 4: Verify core interaction**

In the browser:

1. Drag horizontally across the canvas.
2. Click the current star.
3. Use the compass navigation item for `当前`.

Expected result:

- Drag rotates the scene without showing an empty back side.
- Click opens the information panel after camera focus.
- `当前` brings the camera back to the current star.

## Self-Review Notes

- Spec coverage: first-screen composition, main star, star road, background, interaction, desktop/mobile verification are each covered by a task.
- Scope: no new dependency, no new page, no new content schema, no deployment change.
- Ambiguity resolved: “strong impact” means current star dominance, visible star-road direction, reduced background competition, and separate desktop/mobile screenshots.
