import { createFlightState, stepFlight } from "./flight-model.mjs";
import { applyLookDelta } from "./orientation.mjs";
import {
  createExperienceState,
  handoffWeights,
  transitionExperience,
} from "./experience-state.mjs";

const FIXED_DT = 1 / 120;
const MAX_FRAME_SECONDS = 0.1;
const DEFAULT_FLIGHT_CONFIG = Object.freeze({
  lookSensitivity: 0.0038,
  maxSpeed: 3,
  accelRate: 5,
  stopRate: 7,
  stopEpsilon: 0.001,
  thrustScale: 0.012,
  boundary: { radius: 24, softStart: 20, epsilon: 0.001 },
});

const now = () => performance.now();

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
  onError,
  onFrame,
}) {
  if (!THREE || !canvas || !camera || !scene || !renderer || !inputRouter) {
    throw new TypeError("UniverseRuntime requires a scene, camera, renderer, canvas, and input router");
  }

  const rig = new THREE.Group();
  rig.name = "PlayerRig";
  rig.add(camera);
  scene.add(rig);

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
  let handoffStartedAt = null;
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

  function frame(frameNow) {
    if (!running || destroyed) return;

    try {
      const elapsed = Math.min(MAX_FRAME_SECONDS, Math.max(0, (frameNow - previous) / 1000));
      previous = frameNow;
      accumulator += elapsed;
      introElapsedMs += elapsed * 1000;
      while (accumulator >= FIXED_DT) {
        step();
        accumulator -= FIXED_DT;
      }

      applyFlightState();
      if (
        experience.mode === "handoff" &&
        frameNow - handoffStartedAt >= 500
      ) {
        experience = transitionExperience(experience, { type: "HANDOFF_FINISHED" });
      }
      intro?.setElapsed?.(introElapsedMs);
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
    const previousMode = experience.mode;
    experience = transitionExperience(experience, { type: "USER_INPUT" });
    if (previousMode !== "handoff" && experience.mode === "handoff") {
      handoffStartedAt = now();
    }
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
          ? Math.min(500, now() - handoffStartedAt)
          : 500,
        500,
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
