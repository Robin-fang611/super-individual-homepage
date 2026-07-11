import { constrainProfile } from "./capability-guard.mjs";
import { QUALITY_ORDER, QUALITY_PROFILES } from "./quality-profiles.mjs";

export const DEFAULT_QUALITY_STORAGE_KEY = "ink-universe-quality";

function isQualityName(value) {
  return typeof value === "string" && QUALITY_ORDER.includes(value);
}

function automaticQuality(capabilities = {}) {
  const memory = Number(capabilities.deviceMemory ?? 4);
  const cores = Number(capabilities.hardwareConcurrency ?? 4);

  if (!capabilities.webgl2 || !capabilities.floatTextures || memory <= 2 || cores <= 2) {
    return "performance";
  }

  if (memory >= 8 && cores >= 8) return "high";
  return "balanced";
}

function isPoorFramePacing(summary = {}) {
  if (!Number.isFinite(summary.count) || summary.count < 90) return false;
  return summary.consecutiveOver33 >= 4
    || (summary.p95 > 38 && summary.dropRate > 0.2);
}

export function createQualityController({
  capabilities = {},
  storage = globalThis.localStorage,
  storageKey = DEFAULT_QUALITY_STORAGE_KEY,
  initialQuality,
} = {}) {
  const saved = storage?.getItem?.(storageKey);
  let qualityName = isQualityName(saved)
    ? saved
    : (isQualityName(initialQuality) ? initialQuality : automaticQuality(capabilities));
  let source = isQualityName(saved) ? "manual" : "automatic";
  let lastAdaptedSampleCount = 0;

  function snapshot() {
    return Object.freeze({
      source,
      profile: constrainProfile(QUALITY_PROFILES[qualityName], capabilities),
    });
  }

  function setManual(name) {
    if (!isQualityName(name)) {
      throw new RangeError(`Unknown quality tier: ${name}`);
    }

    qualityName = name;
    source = "manual";
    storage?.setItem?.(storageKey, name);
    return snapshot();
  }

  function clearManual() {
    storage?.removeItem?.(storageKey);
    qualityName = isQualityName(initialQuality) ? initialQuality : automaticQuality(capabilities);
    source = "automatic";
    lastAdaptedSampleCount = 0;
    return snapshot();
  }

  function observe(frameSummary) {
    if (source === "manual" || !isPoorFramePacing(frameSummary)) return snapshot();
    if (frameSummary.count <= lastAdaptedSampleCount) return snapshot();

    lastAdaptedSampleCount = frameSummary.count;
    const currentIndex = QUALITY_ORDER.indexOf(qualityName);
    if (currentIndex > 0) {
      qualityName = QUALITY_ORDER[currentIndex - 1];
      source = "adaptive";
    }
    return snapshot();
  }

  return Object.freeze({ snapshot, setManual, clearManual, observe });
}
