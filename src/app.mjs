function requireElement(selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const appElement = requireElement("#universe-app");
const introElement = requireElement("#intro-screen");
const canvas = requireElement("#universe-canvas");
const heroHud = requireElement("#hero-hud");
const compassToggle = requireElement("#compass-toggle");
const compassMenu = requireElement("#compass-menu");
const fallbackElement = requireElement("#universe-fallback");
const readingOverlay = requireElement("#reading-overlay");
const readingContent = requireElement("#reading-content");
const readingClose = requireElement("#reading-close");
const hintElement = requireElement("#interaction-hint");

function showFallback() {
  appElement.dataset.renderMode = "fallback";
  introElement.setAttribute("aria-hidden", "true");
  fallbackElement.hidden = false;
}

async function boot() {
  try {
    window.__universeBoot = { step: "loading-modules" };
    const [
      { loadRecords },
      { createIntroController },
      { createReadingOverlay },
      { createStarField },
      { createSceneStarLayout },
      { createExplorationHint },
    ] = await Promise.all([
      import("./record-content.mjs?v=universe-map-3"),
      import("./intro-controller.mjs?v=universe-map-3"),
      import("./reading-overlay.mjs?v=universe-map-3"),
      import("./star-field.mjs?v=3d-scene-25"),
      import("./star-layout.mjs?v=3d-scene-25"),
      import("./exploration-hint.mjs?v=universe-map-3"),
    ]);

    window.__universeBoot = { step: "loading-records" };
    const records = await loadRecords();

    // 将 records 转换为 scene star layout 格式
    const stars = records.map((record) => ({
      file: record.id,
      date: record.date,
      title: record.title,
      summary: record.summary,
      type: record.type || "记录",
      current: record.current || false,
      year: record.year || new Date(record.date).getFullYear(),
    }));
    const layout = createSceneStarLayout(stars);

    let starField = null;
    const intro = createIntroController({
      introElement,
      appElement,
      autoPlay: false,
      onDone: () => {
        window.__universeBoot = { step: "ready", records: records.length };
      },
    });
    const reader = createReadingOverlay({
      overlayElement: readingOverlay,
      contentElement: readingContent,
      closeButton: readingClose,
      onClose: () => starField?.resume?.(),
    });
    const hint = createExplorationHint({
      element: hintElement,
      delayMs: 1400,
      visibleMs: 3200,
    });

    window.__universeBoot = { step: "creating-scene", records: records.length };
    starField = await createStarField({
      canvas,
      layout,
      intro,
      onSelect: (star) => {
        // 找到对应的 record
        const record = records.find((r) => r.id === star.file || r.file === star.file || r.id === star.id);
        if (record) {
          starField?.pause?.();
          reader.open(record);
        }
      },
      onEnterRoad: () => {
        console.log("Entered star road");
      },
      onError: showFallback,
    });
    window.__starField = starField;

    // Hero HUD fade on user exploration
    let heroFaded = false;
    function fadeHeroOnExplore() {
      if (heroFaded) return;
      heroFaded = true;
      heroHud.classList.add("is-exploring");
      hint.dismiss();
    }
    canvas.addEventListener("wheel", fadeHeroOnExplore, { once: true });
    canvas.addEventListener("pointerdown", fadeHeroOnExplore, { once: true });
    // Fade after intro natural completion via runtime handoff
    const checkHandoff = setInterval(() => {
      if (heroFaded) { clearInterval(checkHandoff); return; }
      const snap = starField?.getSnapshot?.();
      if (snap && snap.mode === "handoff") {
        setTimeout(fadeHeroOnExplore, 1200);
        hint.schedule();
        clearInterval(checkHandoff);
      }
    }, 400);

    // Star compass toggle
    let compassOpen = false;
    compassToggle.addEventListener("click", () => {
      compassOpen = !compassOpen;
      compassToggle.parentElement.classList.toggle("is-open", compassOpen);
    });

    // Navigation buttons
    for (const btn of compassMenu.querySelectorAll(".compass-anchor")) {
      btn.addEventListener("click", () => {
        compassMenu.parentElement.classList.remove("is-open");
        compassOpen = false;
        fadeHeroOnExplore();
        const target = btn.dataset.nav;
        if (target === "current" || target === "origin") {
          const currentStar = stars.find((s) => s.current);
          if (currentStar && starField) {
            // Call internal click handler — find current beacon and simulate
            const beacons = starField._inkWorld?.getBeacons?.();
            if (beacons) {
              const def = beacons.getDefByStarId?.(currentStar.file);
              if (def) {
                starField?._onSelect?.(def.star);
              }
            }
          }
        } else if (target === "past" && starField) {
          const pastStars = stars.filter((s) => !s.current);
          const farthest = pastStars[pastStars.length - 1];
          if (farthest) {
            const beacons = starField._inkWorld?.getBeacons?.();
            if (beacons) {
              const def = beacons.getDefByStarId?.(farthest.file);
              if (def) {
                starField?._onSelect?.(def.star);
              }
            }
          }
        }
      });
    }

    // Close compass on outside click
    document.addEventListener("click", (event) => {
      if (compassOpen && !event.target.closest(".star-compass")) {
        compassToggle.parentElement.classList.remove("is-open");
        compassOpen = false;
      }
    });
  } catch (error) {
    showFallback();
    window.__universeBoot = {
      step: "error",
      message: error?.message ?? String(error),
      stack: error?.stack ?? "",
    };
    console.error(error);
  }
}

boot();
