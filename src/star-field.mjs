import { createFrameMonitor } from "./universe/frame-monitor.mjs";
import { createInputRouter } from "./universe/input-router.mjs";
import { createInkUniverseWorld } from "./universe/ink-world.mjs";
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
  interactPrompt,
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
    return await initializeStarField({ THREE, canvas, layout, intro, onSelect, onError, interactPrompt, renderer, createWorld });
  } catch (error) {
    renderer.dispose();
    throw error;
  }
}

async function initializeStarField({ THREE, canvas, layout, intro, onSelect, onError, interactPrompt, renderer, createWorld }) {
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
  const INTERACT_RADIUS = 1.4;
  const _camPos = new THREE.Vector3();
  const _beaconPos = new THREE.Vector3();
  let activeInteractable = null;
  const promptLabel = interactPrompt ? interactPrompt.querySelector("#interact-prompt-label") : null;

  function setPromptVisible(visible) {
    if (!interactPrompt) return;
    interactPrompt.hidden = !visible;
    interactPrompt.setAttribute("aria-hidden", String(!visible));
  }

  function updatePrompt(def) {
    if (!interactPrompt) return;
    if (promptLabel) promptLabel.textContent = `阅读 · ${def.star.title}`;
    def.group.getWorldPosition(_beaconPos);
    const projected = _beaconPos.clone().project(camera);
    if (projected.z > 1 || projected.z < -1) {
      setPromptVisible(false);
      return;
    }
    const vp = getViewport();
    const x = (projected.x * 0.5 + 0.5) * vp.width;
    const y = (-projected.y * 0.5 + 0.5) * vp.height;
    interactPrompt.style.transform = `translate(-50%, -100%) translate(${x}px, ${y - 30}px)`;
    setPromptVisible(true);
  }

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

    // Proximity interaction (Genshin-like): surface a prompt near the closest
    // beacon within reach, and let F / tap trigger its reading.
    if (state.paused || !beacons || !interactPrompt) {
      activeInteractable = null;
      setPromptVisible(false);
    } else {
      camera.getWorldPosition(_camPos);
      let nearestDef = null;
      let nearestDist = Infinity;
      for (const def of beacons.beaconDefs) {
        def.group.getWorldPosition(_beaconPos);
        const dist = _camPos.distanceTo(_beaconPos);
        if (dist < INTERACT_RADIUS && dist < nearestDist) {
          nearestDef = def;
          nearestDist = dist;
        }
      }
      activeInteractable = nearestDef ? nearestDef.star : null;
      if (nearestDef) {
        updatePrompt(nearestDef);
      } else {
        setPromptVisible(false);
      }
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
    if (hit) onSelect(hit.star);
  }

  // Track pointer and clicks on canvas
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("click", handleClick);

  function triggerInteract() {
    if (activeInteractable && onSelect) onSelect(activeInteractable);
  }

  function handleInteractKey(event) {
    if (event.code === "KeyF" && activeInteractable) {
      event.preventDefault();
      triggerInteract();
    }
  }

  window.addEventListener("keydown", handleInteractKey);
  if (interactPrompt) {
    interactPrompt.addEventListener("click", triggerInteract);
  }

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

  function pause() {
    state.paused = true;
    runtime.pause();
  }

  function resume() {
    state.paused = false;
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
    window.removeEventListener("keydown", handleInteractKey);
    if (interactPrompt) interactPrompt.removeEventListener("click", triggerInteract);
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
