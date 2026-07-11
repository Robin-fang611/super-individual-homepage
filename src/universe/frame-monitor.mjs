function percentile(values, ratio) {
  if (values.length === 0) return 0;
  return values[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)];
}

export function createFrameMonitor({ windowSize = 120 } = {}) {
  let paused = false;
  let samples = [];

  return {
    push(milliseconds) {
      if (paused || !Number.isFinite(milliseconds) || milliseconds <= 0 || milliseconds >= 250) {
        return;
      }

      samples.push(milliseconds);
      if (samples.length > windowSize) samples.shift();
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    reset() {
      samples = [];
    },
    summary() {
      const sorted = [...samples].sort((left, right) => left - right);
      const longFrameCount = samples.filter((milliseconds) => milliseconds > 33).length;
      let currentStreak = 0;
      let consecutiveOver33 = 0;

      for (const milliseconds of samples) {
        currentStreak = milliseconds > 33 ? currentStreak + 1 : 0;
        consecutiveOver33 = Math.max(consecutiveOver33, currentStreak);
      }

      return {
        count: samples.length,
        p50: percentile(sorted, 0.5),
        p95: percentile(sorted, 0.95),
        longFrameCount,
        dropRate: samples.length === 0 ? 0 : longFrameCount / samples.length,
        consecutiveOver33,
      };
    },
  };
}
