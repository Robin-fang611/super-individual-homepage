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

export function createIntroController({
  introElement,
  appElement,
  onDone,
  durationMs = 4300,
  autoPlay = true,
}) {
  let completed = false;
  let autoPlaying = autoPlay;
  const start = autoPlaying ? performance.now() : 0;

  function applyPhase(phase) {
    introElement.dataset.phase = phase;
    appElement.dataset.introPhase = phase;

    if (phase === "done" && !completed) {
      completed = true;
      introElement.setAttribute("aria-hidden", "true");
      onDone?.();
    }
  }

  function tick(now) {
    if (!autoPlaying || completed) return;

    const elapsedMs = now - start;
    if (elapsedMs >= durationMs) {
      applyPhase("done");
      return;
    }

    applyPhase(getIntroPhase(elapsedMs));
    requestAnimationFrame(tick);
  }

  applyPhase("black");
  if (autoPlaying) requestAnimationFrame(tick);

  return {
    setElapsed(elapsedMs) {
      autoPlaying = false;
      applyPhase(elapsedMs >= durationMs ? "done" : getIntroPhase(elapsedMs));
    },
    skip() {
      autoPlaying = false;
      applyPhase("done");
    },
  };
}
