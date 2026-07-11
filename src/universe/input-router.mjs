const LINE_PX = 16;
const MAX_DELTA_PX = 240;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function normalizeWheelDelta(event, viewport) {
  const scale = event.deltaMode === 1 ? LINE_PX : event.deltaMode === 2 ? viewport.height : 1;
  return {
    x: clamp(event.deltaX * (event.deltaMode === 2 ? viewport.width : scale), -MAX_DELTA_PX, MAX_DELTA_PX),
    y: clamp(event.deltaY * scale, -MAX_DELTA_PX, MAX_DELTA_PX),
  };
}

export function wheelToInput(event, viewport) {
  const { x, y } = normalizeWheelDelta(event, viewport);
  return event.ctrlKey
    ? { lookX: 0, lookY: 0, thrust: -y }
    : { lookX: x, lookY: y, thrust: 0 };
}

export function createInputRouter({ target, getViewport, onInput }) {
  let active = false;
  const keys = new Set();
  const snapshot = { lookX: 0, lookY: 0, thrust: 0, moveRight: 0, moveForward: 0, moveUp: 0 };
  const clear = () => { keys.clear(); Object.assign(snapshot, { lookX: 0, lookY: 0, thrust: 0, moveRight: 0, moveForward: 0, moveUp: 0 }); };
  const emit = () => onInput?.({ ...snapshot, source: "trackpad-keyboard", timestamp: performance.now(), controlActive: active });
  const onWheel = (event) => { if (!active) return; event.preventDefault(); Object.assign(snapshot, wheelToInput(event, getViewport())); emit(); };
  const onKey = (event, down) => { if (!active) return; if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "Space", "ShiftLeft", "ShiftRight"].includes(event.code)) event.preventDefault(); down ? keys.add(event.code) : keys.delete(event.code); snapshot.moveForward = Number(keys.has("KeyW")) - Number(keys.has("KeyS")); snapshot.moveRight = Number(keys.has("KeyD")) - Number(keys.has("KeyA")); snapshot.moveUp = Number(keys.has("Space") || keys.has("KeyE")) - Number(keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("KeyQ")); emit(); };
  const keyDown = (event) => onKey(event, true);
  const keyUp = (event) => onKey(event, false);
  target.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", keyDown, { passive: false });
  window.addEventListener("keyup", keyUp);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", clear);
  return { activate() { active = true; }, deactivate() { active = false; clear(); }, snapshot() { return { ...snapshot }; }, consume() { const frame = { ...snapshot }; snapshot.lookX = 0; snapshot.lookY = 0; snapshot.thrust = 0; return frame; }, destroy() { target.removeEventListener("wheel", onWheel); window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", clear); document.removeEventListener("visibilitychange", clear); clear(); } };
}
