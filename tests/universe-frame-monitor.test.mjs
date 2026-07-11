import test from "node:test";
import assert from "node:assert/strict";

import { createFrameMonitor } from "../src/universe/frame-monitor.mjs";

test("reports frame percentiles and ignores paused samples", () => {
  const monitor = createFrameMonitor({ windowSize: 5 });

  [16, 17, 18, 40, 50].forEach((milliseconds) => monitor.push(milliseconds));
  monitor.pause();
  monitor.push(1000);
  monitor.resume();

  assert.deepEqual(monitor.summary(), {
    count: 5,
    p50: 18,
    p95: 50,
    longFrameCount: 2,
    dropRate: 0.4,
    consecutiveOver33: 2,
  });
});

test("keeps only the configured rolling window", () => {
  const monitor = createFrameMonitor({ windowSize: 3 });
  [10, 20, 30, 40].forEach((milliseconds) => monitor.push(milliseconds));

  assert.equal(monitor.summary().count, 3);
  assert.equal(monitor.summary().p50, 30);
});
