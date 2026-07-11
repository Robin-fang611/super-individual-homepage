const PHASES = [
  { name: "black", until: 720 },
  { name: "message", until: 2100 },
  { name: "collapse", until: 3200 },
  { name: "reveal", until: 4300 },
];

export function getIntroPhase(elapsedMs) {
  const phase = PHASES.find((entry) => elapsedMs < entry.until);
  return phase?.name ?? "done";
}

export function createIntroController({ introElement, appElement, onDone, durationMs = 4300 }) {
  let completed = false;

  function applyPhase(phase) {
    introElement.dataset.phase = phase;
    appElement.dataset.introPhase = phase;

    if (phase === "done" && !completed) {
      completed = true;
      introElement.setAttribute("aria-hidden", "true");
      onDone?.();
    }
  }

  applyPhase("black");

  return {
    setElapsed(elapsedMs) {
      applyPhase(elapsedMs >= durationMs ? "done" : getIntroPhase(elapsedMs));
    },
    skip() {
      applyPhase("done");
    },
  };
}
