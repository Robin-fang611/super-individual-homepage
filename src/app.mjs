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
const readingOverlay = requireElement("#reading-overlay");
const readingContent = requireElement("#reading-content");
const readingClose = requireElement("#reading-close");

async function boot() {
  try {
    window.__universeBoot = { step: "loading-modules" };
    const [
      { loadRecords },
      { createIntroController },
      { createReadingOverlay },
      { createStarField },
      { createStarLayout },
    ] = await Promise.all([
      import("./record-content.mjs?v=universe-map-3"),
      import("./intro-controller.mjs?v=universe-map-3"),
      import("./reading-overlay.mjs?v=universe-map-3"),
      import("./star-field.mjs?v=3d-scene-25"),
      import("./star-layout.mjs?v=3d-scene-25"),
    ]);

    window.__universeBoot = { step: "loading-records" };
    const records = await loadRecords();

    // 将 records 转换为 star-field 需要的 layout 格式
    const stars = records.map((record) => ({
      file: record.id,
      date: record.date,
      title: record.title,
      summary: record.summary,
      type: record.type || "记录",
      current: record.current || false,
      year: record.year || new Date(record.date).getFullYear(),
    }));
    const layout = createStarLayout(stars);

    let starField = null;
    const reader = createReadingOverlay({
      overlayElement: readingOverlay,
      contentElement: readingContent,
      closeButton: readingClose,
      onClose: () => starField?.resume?.(),
    });

    window.__universeBoot = { step: "creating-scene", records: records.length };
    starField = await createStarField({
      canvas,
      layout,
      onSelect: (star) => {
        // 找到对应的 record
        const record = records.find((r) => r.id === star.file || r.id === `${star.date}-${star.title}`);
        if (record) {
          starField?.pause?.();
          reader.open(record);
        }
      },
      onEnterRoad: () => {
        console.log("Entered star road");
      },
    });
    window.__starField = starField;

    createIntroController({
      introElement,
      appElement,
      onDone: () => {
        window.__universeBoot = { step: "ready", records: records.length };
      },
    });
  } catch (error) {
    window.__universeBoot = {
      step: "error",
      message: error?.message ?? String(error),
      stack: error?.stack ?? "",
    };
    console.error(error);
  }
}

boot();
