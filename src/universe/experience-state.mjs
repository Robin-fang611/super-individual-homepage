const TRANSITIONS = {
  loading: { LOADED: "ready" },
  ready: { INTRO_STARTED: "intro" },
  intro: {
    INTRO_FINISHED: "handoff",
    USER_INPUT: "handoff",
    REDUCED_MOTION: "handoff",
    SUSPEND: "suspended",
  },
  handoff: { HANDOFF_FINISHED: "active", SUSPEND: "suspended" },
  active: { PAUSE: "paused", SUSPEND: "suspended" },
  paused: { RESUME: "active" },
  suspended: { RESUME: "active" },
};

export function createExperienceState() {
  return { mode: "loading", previousMode: null, error: null };
}

export function transitionExperience(state, event) {
  if (event.type === "ERROR") {
    return {
      ...state,
      previousMode: state.mode,
      mode: "error",
      error: event.error,
    };
  }

  const nextMode = TRANSITIONS[state.mode]?.[event.type];
  if (!nextMode) return state;

  return {
    ...state,
    previousMode: state.mode,
    mode: nextMode,
  };
}

export function handoffWeights(elapsedMs, durationMs) {
  const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));
  const player = progress * progress * (3 - 2 * progress);
  return { autopilot: 1 - player, player };
}
