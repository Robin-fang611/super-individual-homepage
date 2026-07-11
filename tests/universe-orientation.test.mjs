import test from "node:test";
import assert from "node:assert/strict";

import {
  applyLookDelta,
  forwardFromQuaternion,
  identityQuaternion,
  stabilizeRoll,
} from "../src/universe/orientation.mjs";

test("continues through the top without a pitch clamp", () => {
  let quaternion = identityQuaternion();
  for (let index = 0; index < 220; index += 1) {
    quaternion = applyLookDelta(quaternion, 0, 1, Math.PI / 180);
  }

  const forward = forwardFromQuaternion(quaternion);
  assert.ok(
    forward.z > 0.7,
    `expected to pass beyond 180 degrees, got ${JSON.stringify(forward)}`,
  );
  assert.ok(
    Math.abs(
      Math.hypot(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w,
      ) - 1,
    ) < 1e-9,
  );
});

test("stabilizing roll preserves the forward direction", () => {
  const quaternion = applyLookDelta(
    identityQuaternion(),
    34,
    -27,
    Math.PI / 180,
  );
  const before = forwardFromQuaternion(quaternion);

  const stabilized = stabilizeRoll(
    quaternion,
    { x: 0.4, y: 1, z: -0.2 },
    1 / 60,
    8,
  );
  const after = forwardFromQuaternion(stabilized);
  const forwardDot =
    before.x * after.x + before.y * after.y + before.z * after.z;

  assert.ok(
    forwardDot > 0.999999,
    `expected forward to be preserved, got ${forwardDot}`,
  );
});

test("a comfort up parallel to forward stays finite", () => {
  const quaternion = applyLookDelta(
    identityQuaternion(),
    18,
    63,
    Math.PI / 180,
  );
  const forward = forwardFromQuaternion(quaternion);

  const stabilized = stabilizeRoll(quaternion, forward, 1 / 60, 8);

  assert.ok(
    [stabilized.x, stabilized.y, stabilized.z, stabilized.w].every(
      Number.isFinite,
    ),
    `expected a finite quaternion, got ${JSON.stringify(stabilized)}`,
  );
  assert.ok(
    Math.abs(
      Math.hypot(stabilized.x, stabilized.y, stabilized.z, stabilized.w) - 1,
    ) < 1e-9,
  );
});
