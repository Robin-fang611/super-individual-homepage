import { createFrameMonitor } from "./universe/frame-monitor.mjs";
import { createInputRouter } from "./universe/input-router.mjs";
import { createInkUniverseWorld } from "./universe/ink-world.mjs";
import { buildIntroFlightPath } from "./universe/intro-flight-path.mjs";
import { createFlightState, stepFlight } from "./universe/flight-model.mjs";
import { createQualityController } from "./universe/quality-controller.mjs";
import { createUniverseRuntime } from "./universe/runtime.mjs";
import { CAMERA_FAR_PLANE, FLIGHT_BOUNDARY_RADIUS } from "./universe/world-constants.mjs";

const THREE_URL = "/assets/three.module.js";
let threeModulePromise;

function loadThree() {
  if (!threeModulePromise) threeModulePromise = import(THREE_URL);
  return threeModulePromise;
}

function rendererCapabilities(renderer) {
  return {
    webgl2: renderer.capabilities.isWebGL2,
    floatTextures: renderer.capabilities.isWebGL2,
    maxTextureSize: renderer.capabilities.maxTextureSize,
    deviceMemory: navigator.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
  };
}

/**
 * The current homepage deliberately starts without content nodes. The old record
 * reader remains intact and can later attach landmarks to this world.
 */
export async function createStarField({
  canvas,
  layout,
  intro,
  onSelect,
  onError,
  loadThreeModule = loadThree,
  createWorld = createInkUniverseWorld,
}) {
  const THREE = await loadThreeModule();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });

  try {
    return await initializeStarField({ THREE, canvas, layout, intro, onSelect, onError, renderer, createWorld });
  } catch (error) {
    renderer.dispose();
    throw error;
  }
}

async function initializeStarField({ THREE, canvas, layout, intro, onSelect, onError, renderer, createWorld }) {
  renderer.setClearColor(0x010306, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const quality = createQualityController({
    capabilities: rendererCapabilities(renderer),
  });
  let activeProfile = quality.snapshot().profile;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, activeProfile.dprMax));

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02080e, 0.018);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, CAMERA_FAR_PLANE);
  const inkWorld = await createWorld({ THREE, profile: activeProfile, layout });
  scene.add(inkWorld.group);

  const frameMonitor = createFrameMonitor();
  const state = { disposed: false, lastFrameTime: 0, paused: false };
  let runtime;
  let pointerX = -9999;
  let pointerY = -9999;
  let lastClickTime = 0;
  let savedFlightState = null;

  function reportError(error) {
    onError?.(error);
  }

  function onContextLost(event) {
    event.preventDefault();
    runtime?.pause();
    reportError(new Error("WebGL context lost"));
  }

  function applyProfile(nextProfile) {
    activeProfile = nextProfile;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, activeProfile.dprMax));
    inkWorld.setQuality(activeProfile);
  }

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function getViewport() {
    return {
      width: canvas.clientWidth || window.innerWidth,
      height: canvas.clientHeight || window.innerHeight,
    };
  }

  function animateWorld(time) {
    if (state.lastFrameTime) frameMonitor.push(time - state.lastFrameTime);
    state.lastFrameTime = time;

    const snapshot = runtime ? runtime.getSnapshot() : { mode: "active" };
    inkWorld.update(time, camera, { mode: snapshot.mode });

    // Hover detection — use tracked pointer position
    const beacons = inkWorld.getBeacons?.();
    if (beacons && !state.paused) {
      const vp = getViewport();
      const hit = beacons.hitTest(camera, vp, pointerX, pointerY);
      beacons.applyHover(hit);
    }

    const before = activeProfile.name;
    const next = quality.observe(frameMonitor.summary()).profile;
    if (next.name !== before) {
      applyProfile(next);
      frameMonitor.reset();
    }
  }

  const inputRouter = createInputRouter({
    target: canvas,
    getViewport: () => ({
      width: canvas.clientWidth || window.innerWidth,
      height: canvas.clientHeight || window.innerHeight,
    }),
    onInput: () => runtime?.requestHandoff(),
  });

  function handlePointerMove(event) {
    pointerX = event.clientX;
    pointerY = event.clientY;
  }

  function handleClick(event) {
    const now = performance.now();
    // Debounce clicks to avoid double-fire from input handoff
    if (now - lastClickTime < 300) return;
    lastClickTime = now;

    if (!onSelect) return;
    const beacons = inkWorld.getBeacons?.();
    if (!beacons) return;

    const hit = beacons.hitTest(camera, getViewport(), event.clientX, event.clientY);
    if (hit) {
      // Save current flight state before jumping
      const rig = scene.getObjectByName("PlayerRig");
      if (rig) {
        savedFlightState = {
          position: rig.position.clone(),
          quaternion: rig.quaternion.clone(),
        };
        const pos = hit.group.position;
        rig.position.set(pos.x + 0.8, pos.y - 0.3, pos.z + 1.2);
        rig.quaternion.setFromEuler(new THREE.Euler(0.12, -0.3, 0, "YXZ"));
      }
      onSelect(hit.star);
    }
  }

  // Track pointer and clicks on canvas
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("click", handleClick);

  const initialQuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0.08, -0.14, 0, "YXZ"),
  );
  const initialFlightState = createFlightState({
    position: { x: -0.2, y: 0.8, z: 5.4 },
    quaternion: initialQuaternion,
  });
  const introPath = layout?.sceneStars?.length
    ? buildIntroFlightPath({
        start: initialFlightState.position,
        stars: layout.sceneStars,
        boundaryRadius: FLIGHT_BOUNDARY_RADIUS,
      })
    : null;
  runtime = createUniverseRuntime({
    THREE,
    canvas,
    camera,
    scene,
    renderer,
    intro,
    inputRouter,
    introPath,
    initialFlightState,
    onFrame: animateWorld,
    onError: (error) => {
      console.error(error);
      reportError(error);
    },
  });

  function setQuality(name) {
    const next = quality.setManual(name).profile;
    applyProfile(next);
    frameMonitor.reset();
    return next;
  }

  function useAutomaticQuality() {
    const next = quality.clearManual().profile;
    applyProfile(next);
    frameMonitor.reset();
    return next;
  }

  function pause() {
    state.paused = true;
    runtime.pause();
  }

  function resume() {
    state.paused = false;
    // Restore saved flight state if we jumped to a node
    if (savedFlightState) {
      const rig = scene.getObjectByName("PlayerRig");
      if (rig) {
        rig.position.copy(savedFlightState.position);
        rig.quaternion.copy(savedFlightState.quaternion);
      }
      savedFlightState = null;
    }
    runtime.resume();
  }

  function destroy() {
    if (state.disposed) return;
    state.disposed = true;
    runtime.destroy();
    window.removeEventListener("resize", resize);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("pointermove", handlePointerMove);
    canvas.removeEventListener("click", handleClick);
    inkWorld.dispose();
    renderer.dispose();
  }

  window.addEventListener("resize", resize);
  canvas.addEventListener("webglcontextlost", onContextLost);
  resize();
  runtime.start();

  return {
    ...runtime,
    pause,
    resume,
    destroy,
    getQuality: () => quality.snapshot(),
    setQuality,
    useAutomaticQuality,
    _inkWorld: inkWorld,
    _onSelect: onSelect,
  };
}
