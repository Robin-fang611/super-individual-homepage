import { loadRecords } from "./record-content.mjs";

const INNER_MANIFEST = "/content/inner/index.json";
const STARDUST_KEY = "stardust:traces";
const STARDUST_SEED = [
  { text: "第一次来到这里，安静得能听见自己的心跳。", ts: Date.now() - 1000 * 60 * 60 * 24 * 3 },
  { text: "愿每颗星标都通向更辽阔的自己。", ts: Date.now() - 1000 * 60 * 60 * 24 },
  { text: "原来宇宙，也可以是一个人的。", ts: Date.now() - 1000 * 60 * 90 },
];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function formatDate(ts) {
  const date = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function loadStardust() {
  try {
    const raw = localStorage.getItem(STARDUST_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore unavailable storage */
  }
  return STARDUST_SEED.slice();
}

function saveStardust(list) {
  try {
    localStorage.setItem(STARDUST_KEY, JSON.stringify(list));
  } catch {
    /* ignore unavailable storage */
  }
}

export function createRealmSwitch({ appElement, starField, navElement, innerElement, interactiveElement }) {
  const pills = [...navElement.querySelectorAll(".realm-pill")];
  const innerThoughts = innerElement.querySelector("#inner-thoughts");
  const stardustForm = interactiveElement.querySelector("#stardust-form");
  const stardustInput = interactiveElement.querySelector("#stardust-input");
  const stardustCount = interactiveElement.querySelector("#stardust-count");
  const stardustCloud = interactiveElement.querySelector("#stardust-cloud");
  const stardustTotal = interactiveElement.querySelector(".stardust-total");
  let current = "road";

  async function loadInner() {
    try {
      const records = await loadRecords(INNER_MANIFEST);
      innerThoughts.innerHTML = "";
      for (const record of records) {
        const card = document.createElement("article");
        card.className = "inner-thought";
        card.innerHTML = `
          <p class="inner-thought__date">${escapeHtml(record.date)}</p>
          <h3 class="inner-thought__title">${escapeHtml(record.title)}</h3>
          <p class="inner-thought__summary">${escapeHtml(record.summary ?? "")}</p>
          <div class="inner-thought__body" hidden>${escapeHtml(record.body ?? "")}</div>`;
        const body = card.querySelector(".inner-thought__body");
        card.addEventListener("click", () => {
          const willOpen = body.hasAttribute("hidden");
          body.toggleAttribute("hidden", !willOpen);
          card.classList.toggle("is-open", willOpen);
        });
        innerThoughts.appendChild(card);
      }
    } catch {
      innerThoughts.innerHTML = `<p class="realm-empty">内心星思暂未成形。</p>`;
    }
  }

  function renderStardust() {
    const list = loadStardust();
    stardustCloud.innerHTML = "";
    for (const trace of list.slice().reverse()) {
      const chip = document.createElement("span");
      chip.className = "stardust-chip";
      chip.title = formatDate(trace.ts);
      chip.textContent = trace.text;
      stardustCloud.appendChild(chip);
    }
    if (stardustTotal) stardustTotal.textContent = String(list.length);
  }

  function updateCount() {
    stardustCount.textContent = `${stardustInput.value.length} / 140`;
  }

  function setRealm(realm) {
    if (realm === current) return;
    current = realm;
    appElement.dataset.realm = realm;
    for (const pill of pills) {
      pill.classList.toggle("is-active", pill.dataset.realm === realm);
    }
    const showInner = realm === "inner";
    const showInteractive = realm === "interactive";
    innerElement.hidden = !showInner;
    interactiveElement.hidden = !showInteractive;
    innerElement.setAttribute("aria-hidden", String(!showInner));
    interactiveElement.setAttribute("aria-hidden", String(!showInteractive));

    if (realm === "road") {
      starField?.resume?.();
    } else {
      starField?.pause?.();
      if (showInner) loadInner();
      if (showInteractive) renderStardust();
    }
  }

  for (const pill of pills) {
    pill.addEventListener("click", () => setRealm(pill.dataset.realm));
  }

  stardustInput.addEventListener("input", updateCount);
  stardustForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = stardustInput.value.trim();
    if (!text) return;
    const list = loadStardust();
    list.push({ text, ts: Date.now() });
    saveStardust(list);
    stardustInput.value = "";
    updateCount();
    renderStardust();
  });

  appElement.dataset.realm = "road";
  updateCount();
  return { setRealm };
}
