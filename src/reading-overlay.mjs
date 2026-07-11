function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderMarkdown(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const html = [];
  let paragraph = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    html.push(`<p>${paragraph.map(escapeHtml).join("<br>")}</p>`);
    paragraph = [];
  }

  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      html.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("# ")) {
      flushParagraph();
      html.push(`<h2>${escapeHtml(line.slice(2))}</h2>`);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return html.join("\n");
}

export function createReadingOverlay({ overlayElement, contentElement, closeButton, onClose }) {
  let activeRecord = null;

  function open(record) {
    activeRecord = record;
    contentElement.innerHTML = `
      <header class="reading-header">
        <p class="reading-date">${escapeHtml(record.date)}</p>
        <h1>${escapeHtml(record.title)}</h1>
        ${record.summary ? `<p class="reading-summary">${escapeHtml(record.summary)}</p>` : ""}
      </header>
      <div class="reading-body">${renderMarkdown(record.body)}</div>
    `;
    overlayElement.classList.add("is-open");
    overlayElement.setAttribute("aria-hidden", "false");
    contentElement.focus({ preventScroll: true });
  }

  function close() {
    activeRecord = null;
    overlayElement.classList.remove("is-open");
    overlayElement.setAttribute("aria-hidden", "true");
    onClose?.();
  }

  closeButton.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeRecord) close();
  });

  return { open, close, getActiveRecord: () => activeRecord };
}
