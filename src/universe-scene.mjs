import {
  applyTrackpadMovement,
  clampPan,
  createBackgroundStars,
  createRecordNodes,
  getDepthScale,
  getParallaxOffset,
  hitTestNode,
} from "./universe-layout.mjs?v=universe-map-3";

const WORLD = { width: 2800, height: 1700 };
const STAR_LAYERS = [
  { name: "far", strength: 0.22, count: 560, seed: 31 },
  { name: "mid", strength: 0.62, count: 430, seed: 47 },
  { name: "near", strength: 1.08, count: 230, seed: 83 },
];

function drawGlow(context, x, y, radius, color, alpha) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color.replace("ALPHA", String(alpha)));
  gradient.addColorStop(0.46, color.replace("ALPHA", String(alpha * 0.22)));
  gradient.addColorStop(1, color.replace("ALPHA", "0"));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function drawInkNebula(context, view, time, pan) {
  const driftX = Math.sin(time / 6200) * 24 - pan.x * 0.05;
  const driftY = Math.cos(time / 7400) * 18 - pan.y * 0.04;

  context.save();
  context.globalCompositeOperation = "screen";
  drawGlow(context, view.width * 0.66 + driftX, view.height * 0.28 + driftY, view.width * 0.52, "rgba(86, 198, 230, ALPHA)", 0.17);
  drawGlow(context, view.width * 0.3 - driftX * 0.6, view.height * 0.74 - driftY * 0.5, view.width * 0.34, "rgba(216, 184, 106, ALPHA)", 0.045);
  drawGlow(context, view.width * 0.18 + driftY, view.height * 0.24 - driftX * 0.25, view.width * 0.28, "rgba(75, 232, 214, ALPHA)", 0.055);
  context.restore();
}

export function createUniverseScene({ canvas, records, onSelect }) {
  const context = canvas.getContext("2d", { alpha: true });
  const mobileQuery = window.matchMedia("(max-width: 760px)");
  const state = {
    pan: { x: 0, y: 0 },
    depth: 1,
    velocity: { x: 0, y: 0 },
    dragging: false,
    dragDistance: 0,
    pointer: { x: -9999, y: -9999 },
    lastPointer: { x: 0, y: 0 },
    raf: 0,
    disposed: false,
    paused: false,
    screenNodes: [],
  };
  const stars = STAR_LAYERS.map((layer) => ({
    ...layer,
    stars: createBackgroundStars({
      count: mobileQuery.matches ? Math.floor(layer.count * 0.6) : layer.count,
      seed: layer.seed,
      width: WORLD.width,
      height: WORLD.height,
    }),
  }));
  const nodes = createRecordNodes(records, WORLD);
  let lastPublishedCamera = "";

  function publishCameraState() {
    const value = `${state.pan.x.toFixed(2)},${state.pan.y.toFixed(2)},${state.depth.toFixed(3)}`;
    if (value === lastPublishedCamera) return;

    lastPublishedCamera = value;
    canvas.dataset.panX = state.pan.x.toFixed(2);
    canvas.dataset.panY = state.pan.y.toFixed(2);
    canvas.dataset.depth = state.depth.toFixed(3);
  }

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, mobileQuery.matches ? 1.4 : 2);
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    publishCameraState();
  }

  function viewport() {
    return {
      width: canvas.clientWidth || window.innerWidth,
      height: canvas.clientHeight || window.innerHeight,
    };
  }

  function worldToScreen(point, strength = 1) {
    const view = viewport();
    const depth = getDepthScale(state.depth);
    const offset = getParallaxOffset(state.pan, strength);
    const offsetScale = 0.72 + depth * 0.28;
    return {
      x: view.width / 2 + point.x * depth + offset.x * offsetScale,
      y: view.height / 2 + point.y * depth + offset.y * offsetScale,
    };
  }

  function drawBackground(time) {
    const view = viewport();
    context.clearRect(0, 0, view.width, view.height);

    const base = context.createLinearGradient(0, 0, view.width, view.height);
    base.addColorStop(0, "#02040b");
    base.addColorStop(0.38, "#071426");
    base.addColorStop(0.72, "#03111a");
    base.addColorStop(1, "#02040b");
    context.fillStyle = base;
    context.fillRect(0, 0, view.width, view.height);

    drawInkNebula(context, view, time, state.pan);

    const depth = getDepthScale(state.depth);

    for (const layer of stars) {
      for (const star of layer.stars) {
        const point = worldToScreen(star, layer.strength);
        if (point.x < -20 || point.y < -20 || point.x > view.width + 20 || point.y > view.height + 20) continue;

        const twinkle = 0.72 + Math.sin(time / 1200 + star.phase) * 0.28;
        const radius = star.radius * (0.78 + depth * (layer.name === "near" ? 0.34 : 0.16));
        context.fillStyle = star.warmth
          ? `rgba(216, 184, 106, ${star.alpha * twinkle})`
          : `rgba(226, 244, 255, ${star.alpha * twinkle})`;
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawRiver(time) {
    const view = viewport();
    const depth = getDepthScale(state.depth);
    const offset = getParallaxOffset(state.pan, 0.76);
    const offsetScale = 0.72 + depth * 0.28;
    const startX = view.width * 0.74 + offset.x * offsetScale;
    const startY = view.height * 0.9 + offset.y * offsetScale;

    context.save();
    context.globalCompositeOperation = "screen";
    context.lineCap = "round";
    context.lineJoin = "round";

    for (let lane = 0; lane < 7; lane += 1) {
      const drift = Math.sin(time / 2600 + lane * 0.8) * 18;
      context.beginPath();
      context.moveTo(startX - lane * 32, startY + lane * 12);
      context.bezierCurveTo(
        view.width * (0.57 - lane * 0.01) + offset.x * 0.86,
        view.height * (0.64 + lane * 0.014) + offset.y + drift,
        view.width * (0.43 + lane * 0.008) + offset.x * 0.68,
        view.height * (0.38 - lane * 0.022) + offset.y - drift,
        view.width * (0.2 + lane * 0.018) + offset.x * 0.54,
        view.height * (0.17 + lane * 0.004) + offset.y * 0.78,
      );
      context.strokeStyle = lane === 0 ? "rgba(222, 250, 255, 0.38)" : "rgba(126, 222, 255, 0.115)";
      context.lineWidth = (lane === 0 ? 7 : 2.6) * (0.82 + depth * 0.18);
      context.stroke();
    }

    context.restore();
  }

  function drawNodes(time) {
    const screenNodes = [];
    const depth = getDepthScale(state.depth);
    const nodeScale = 0.78 + depth * 0.28;

    for (const node of nodes) {
      const point = worldToScreen(node, 0.88);
      const revealRadius = node.revealRadius * nodeScale;
      const distance = Math.hypot(state.pointer.x - point.x, state.pointer.y - point.y);
      const hovered = distance <= revealRadius;
      const pulse = 0.8 + Math.sin(time / 900 + node.progress * Math.PI * 2) * 0.2;
      const alpha = hovered ? 0.92 : 0.35 + node.glow * 0.22 * pulse;
      const radius = (hovered ? node.radius * 1.25 : node.radius) * nodeScale;

      screenNodes.push({ ...node, revealRadius, screenX: point.x, screenY: point.y });

      context.save();
      context.globalCompositeOperation = "screen";
      drawGlow(context, point.x, point.y, revealRadius * (hovered ? 1.3 : 0.72), "rgba(130, 223, 255, ALPHA)", hovered ? 0.22 : 0.075);
      context.fillStyle = `rgba(244, 252, 255, ${alpha})`;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    state.screenNodes = screenNodes;
  }

  function render(time = 0) {
    if (state.disposed) return;

    const view = viewport();
    if (!state.dragging && !state.paused) {
      state.pan.x += state.velocity.x;
      state.pan.y += state.velocity.y;
      state.velocity.x *= 0.92;
      state.velocity.y *= 0.92;
      state.pan = clampPan(state.pan, WORLD, view);
      publishCameraState();
    }

    drawBackground(time);
    drawRiver(time);
    drawNodes(time);

    state.raf = requestAnimationFrame(render);
  }

  function onPointerDown(event) {
    canvas.setPointerCapture?.(event.pointerId);
    state.dragging = true;
    state.dragDistance = 0;
    state.lastPointer = { x: event.clientX, y: event.clientY };
    state.velocity = { x: 0, y: 0 };
  }

  function onPointerMove(event) {
    state.pointer = { x: event.clientX, y: event.clientY };

    if (!state.dragging) return;

    const delta = {
      x: event.clientX - state.lastPointer.x,
      y: event.clientY - state.lastPointer.y,
    };
    state.dragDistance += Math.hypot(delta.x, delta.y);
    state.pan.x -= delta.x;
    state.pan.y -= delta.y;
    state.pan = clampPan(state.pan, WORLD, viewport());
    state.velocity = { x: -delta.x * 0.52, y: -delta.y * 0.52 };
    state.lastPointer = { x: event.clientX, y: event.clientY };
    publishCameraState();
  }

  function onPointerUp(event) {
    state.dragging = false;
    canvas.releasePointerCapture?.(event.pointerId);
  }

  function onClick(event) {
    if (state.dragDistance > 8) return;
    const hit = hitTestNode(state.screenNodes, { x: event.clientX, y: event.clientY });
    if (hit) onSelect?.(hit);
  }

  function onWheel(event) {
    event.preventDefault();
    const previousPan = { ...state.pan };
    const nextCamera = applyTrackpadMovement(
      { pan: state.pan, depth: state.depth },
      event,
      WORLD,
      viewport(),
    );

    state.pan = nextCamera.pan;
    state.depth = nextCamera.depth;
    state.velocity = {
      x: (state.pan.x - previousPan.x) * 0.14,
      y: (state.pan.y - previousPan.y) * 0.14,
    };
    publishCameraState();
  }

  function pause() {
    state.paused = true;
  }

  function resume() {
    state.paused = false;
  }

  window.addEventListener("resize", resize);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("click", onClick);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  resize();
  state.raf = requestAnimationFrame(render);

  return {
    pause,
    resume,
    getSnapshot() {
      return {
        pan: { ...state.pan },
        depth: state.depth,
        nodes: state.screenNodes.map((node) => ({ id: node.id, screenX: node.screenX, screenY: node.screenY })),
      };
    },
    destroy() {
      state.disposed = true;
      cancelAnimationFrame(state.raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", onWheel);
    },
  };
}
