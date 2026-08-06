import { createFlightState, stepFlight } from "./flight-model.mjs";
import { applyLookDelta } from "./orientation.mjs";
import { FLIGHT_BOUNDARY_RADIUS } from "./world-constants.mjs";
import {
  createExperienceState,
  handoffWeights,
  transitionExperience,
} from "./experience-state.mjs";

const FIXED_DT = 1 / 120;
const MAX_FRAME_SECONDS = 0.1;
const DEFAULT_INTRO_DURATION_MS = 4300;
const DEFAULT_HANDOFF_DURATION_MS = 400;
const DEFAULT_FLIGHT_CONFIG = Object.freeze({
  lookSensitivity: 0.0038,
  maxSpeed: 3,
  accelRate: 5,
  stopRate: 7,
  stopEpsilon: 0.001,
  thrustScale: 0.012,
  boundary: { radius: FLIGHT_BOUNDARY_RADIUS, softStart: 20, epsilon: 0.001 },
});

export function createUniverseRuntime({
  THREE,
  canvas,
  camera,
  scene,
  renderer,
  intro,
  inputRouter,
  flightConfig = {},
  initialFlightState,
  introPath,
  onError,
  onFrame,
  introDurationMs = DEFAULT_INTRO_DURATION_MS,
  handoffDurationMs = DEFAULT_HANDOFF_DURATION_MS,
  now = () => performance.now(),
  matchMedia = globalThis.matchMedia?.bind(globalThis),
}) {
  if (!THREE || !canvas || !camera || !scene || !renderer || !inputRouter) {
    throw new TypeError("UniverseRuntime requires a scene, camera, renderer, canvas, and input router");
  }

  const rig = new THREE.Group();
  rig.name = "PlayerRig";
  rig.add(camera);
  scene.add(rig);

  const pathProbe = introPath ? new THREE.Object3D() : null;
  const introDuration = introPath?.durationMs ?? introDurationMs;

  const config = {
    ...DEFAULT_FLIGHT_CONFIG,
    ...flightConfig,
    boundary: { ...DEFAULT_FLIGHT_CONFIG.boundary, ...flightConfig.boundary },
  };
  let raf = 0;
  let running = false;
  let destroyed = false;
  let accumulator = 0;
  let previous = now();
  let introElapsedMs = 0;
  let introDone = false;
  let handoffElapsedMs = 0;
  let flightState = initialFlightState ?? createFlightState();
  let experience = transitionExperience(createExperienceState(), { type: "LOADED" });
  experience = transitionExperience(experience, { type: "INTRO_STARTED" });

  function applyFlightState() {
    rig.position.set(
      flightState.position.x,
      flightState.position.y,
      flightState.position.z,
    );
    rig.quaternion.set(
      flightState.quaternion.x,
      flightState.quaternion.y,
      flightState.quaternion.z,
      flightState.quaternion.w,
    );
  }

  function step() {
    const input = inputRouter.consume();
    if (input.lookX || input.lookY) {
      flightState = {
        ...flightState,
        quaternion: applyLookDelta(
          flightState.quaternion,
          input.lookX,
          input.lookY,
          config.lookSensitivity,
        ),
      };
    }
    flightState = stepFlight(flightState, input, FIXED_DT, config);
  }

  function beginHandoff(eventType) {
    const previousMode = experience.mode;
    experience = transitionExperience(experience, { type: eventType });
    if (previousMode !== "handoff" && experience.mode === "handoff") {
      handoffElapsedMs = 0;
      if (!introDone) {
        introDone = true;
        intro?.skip?.();
      }
      return true;
    }

    return false;
  }

  function frame(frameNow) {
    if (!running || destroyed) return;

    try {
      const elapsed = Math.min(MAX_FRAME_SECONDS, Math.max(0, (frameNow - previous) / 1000));
      previous = frameNow;
      accumulator += elapsed;
      while (accumulator >= FIXED_DT) {
        step();
        accumulator -= FIXED_DT;
      }

      applyFlightState();
      let handoffStartedThisFrame = false;
      if (!introDone) {
        introElapsedMs += elapsed * 1000;
        intro?.setElapsed?.(introElapsedMs);
        if (experience.mode === "intro" && introPath && pathProbe) {
          const sample = introPath.pointAt(introElapsedMs / introDuration);
          pathProbe.position.set(sample.position.x, sample.position.y, sample.position.z);
          pathProbe.lookAt(sample.lookAt.x, sample.lookAt.y, sample.lookAt.z);
          flightState = {
            position: { ...sample.position },
            velocity: { x: 0, y: 0, z: 0 },
            quaternion: {
              x: pathProbe.quaternion.x,
              y: pathProbe.quaternion.y,
              z: pathProbe.quaternion.z,
              w: pathProbe.quaternion.w,
            },
          };
        }
        if (experience.mode === "intro" && introElapsedMs >= introDuration) {
          handoffStartedThisFrame = beginHandoff("INTRO_FINISHED");
        }
      }
      if (experience.mode === "handoff" && !handoffStartedThisFrame) {
        handoffElapsedMs += elapsed * 1000;
      }
      if (experience.mode === "handoff" && handoffElapsedMs >= handoffDurationMs) {
        experience = transitionExperience(experience, { type: "HANDOFF_FINISHED" });
      }
      onFrame?.(frameNow, { flightState, experience });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    } catch (error) {
      running = false;
      inputRouter.deactivate();
      experience = transitionExperience(experience, { type: "ERROR", error });
      onError?.(error);
    }
  }

  function start() {
    if (destroyed || running) return;
    running = true;
    previous = now();
    if (matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      beginHandoff("REDUCED_MOTION");
    }
    inputRouter.activate();
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    if (destroyed || !running) return;
    running = false;
    inputRouter.deactivate();
    experience = transitionExperience(experience, { type: "PAUSE" });
    cancelAnimationFrame(raf);
  }

  function resume() {
    if (destroyed) return;
    experience = transitionExperience(experience, { type: "RESUME" });
    start();
  }

  function requestHandoff() {
    beginHandoff("USER_INPUT");
    inputRouter.activate();
  }

  function getSnapshot() {
    return {
      position: rig.position.toArray(),
      quaternion: rig.quaternion.toArray(),
      running,
      mode: experience.mode,
      handoff: handoffWeights(
        experience.mode === "handoff"
          ? Math.min(handoffDurationMs, handoffElapsedMs)
          : handoffDurationMs,
        handoffDurationMs,
      ),
    };
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    running = false;
    cancelAnimationFrame(raf);
    inputRouter.destroy();
    rig.remove(camera);
    scene.remove(rig);
  }

  applyFlightState();
  return { start, pause, resume, destroy, getSnapshot, requestHandoff };
}
