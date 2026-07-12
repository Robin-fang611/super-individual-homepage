import { createFrameMonitor } from "./universe/frame-monitor.mjs";
import { createInputRouter } from "./universe/input-router.mjs";
import { createInkUniverseWorld } from "./universe/ink-world.mjs";
import { createFlightState } from "./universe/flight-model.mjs";
import { createQualityController } from "./universe/quality-controller.mjs";
import { createUniverseRuntime } from "./universe/runtime.mjs";
import { CAMERA_FAR_PLANE } from "./universe/world-constants.mjs";

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
  intro,
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
    return await initializeStarField({ THREE, canvas, intro, onError, renderer, createWorld });
  } catch (error) {
    renderer.dispose();
    throw error;
  }
}

async function initializeStarField({ THREE, canvas, intro, onError, renderer, createWorld }) {
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
  const inkWorld = await createWorld({ THREE, profile: activeProfile });
  scene.add(inkWorld.group);

  const frameMonitor = createFrameMonitor();
  const state = { disposed: false, lastFrameTime: 0 };
  let runtime;

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

  function animateWorld(time) {
    if (state.lastFrameTime) frameMonitor.push(time - state.lastFrameTime);
    state.lastFrameTime = time;
    inkWorld.update(time);

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
  const initialQuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0.08, -0.14, 0, "YXZ"),
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
      position: { x: -0.2, y: 0.8, z: 5.4 },
      quaternion: initialQuaternion,
    }),
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

  function destroy() {
    if (state.disposed) return;
    state.disposed = true;
    runtime.destroy();
    window.removeEventListener("resize", resize);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    inkWorld.dispose();
    renderer.dispose();
  }

  window.addEventListener("resize", resize);
  canvas.addEventListener("webglcontextlost", onContextLost);
  resize();
  runtime.start();

  return {
    ...runtime,
    destroy,
    getQuality: () => quality.snapshot(),
    setQuality,
    useAutomaticQuality,
  };
}
