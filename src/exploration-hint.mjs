export function getHintPhase(elapsedMs, { delayMs, visibleMs }) {
  if (elapsedMs < delayMs) return "hidden";
  if (elapsedMs < delayMs + visibleMs) return "visible";
  return "done";
}

export function createExplorationHint({ element, delayMs = 900, visibleMs = 2600 }) {
  let showTimer = 0;
  let hideTimer = 0;
  let dismissed = false;
  let scheduled = false;

  function dismiss() {
    dismissed = true;
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    element.dataset.phase = "done";
    element.setAttribute("aria-hidden", "true");
  }

  function schedule() {
    if (dismissed || scheduled) return;

    scheduled = true;
    showTimer = window.setTimeout(() => {
      if (dismissed) return;
      element.dataset.phase = "visible";
      element.setAttribute("aria-hidden", "false");
      hideTimer = window.setTimeout(dismiss, visibleMs);
    }, delayMs);
  }

  return { schedule, dismiss, destroy: dismiss };
}
