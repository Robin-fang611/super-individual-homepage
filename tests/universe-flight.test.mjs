import test from "node:test";
import assert from "node:assert/strict";

import {
  applySphericalBoundary,
  createFlightState,
  stepFlight,
} from "../src/universe/flight-model.mjs";

const boundary = { radius: 10, softStart: 8.5, epsilon: 1e-4 };
const config = {
  maxSpeed: 12,
  accelRate: 7,
  stopRate: 9,
  stopEpsilon: 1e-3,
  thrustScale: 1,
  boundary,
};

const radiusOf = (position) =>
  Math.hypot(position.x, position.y, position.z);

const speedOf = (velocity) =>
  Math.hypot(velocity.x, velocity.y, velocity.z);

test("removes outward velocity but preserves tangential velocity", () => {
  const result = applySphericalBoundary(
    { x: 9.99, y: 0, z: 0 },
    { x: 4, y: 3, z: 0 },
    boundary,
  );

  assert.ok(result.velocity.x < 0.01);
  assert.ok(Math.abs(result.velocity.y - 3) < 1e-9);
  assert.equal(result.velocity.z, 0);
});

test("preserves inward velocity in the soft boundary zone", () => {
  const velocity = { x: -4, y: 3, z: 2 };
  const result = applySphericalBoundary(
    { x: 9.99, y: 0, z: 0 },
    velocity,
    boundary,
  );

  assert.deepEqual(result.velocity, velocity);
});

test("rejects an invalid spherical boundary configuration", () => {
  const position = { x: 0, y: 0, z: 0 };
  const velocity = { x: 0, y: 0, z: 0 };

  assert.throws(
    () => applySphericalBoundary(position, velocity, {
      radius: 10,
      softStart: 10,
      epsilon: 1e-4,
    }),
    RangeError,
  );
  assert.throws(
    () => applySphericalBoundary(position, velocity, {
      radius: 10,
      softStart: 8,
      epsilon: 10,
    }),
    RangeError,
  );
  assert.throws(
    () => applySphericalBoundary(position, velocity, {
      radius: Infinity,
      softStart: 8,
      epsilon: 1e-4,
    }),
    RangeError,
  );
});

test("never returns a position outside the playable sphere", () => {
  for (let index = 0; index < 10000; index += 1) {
    const result = applySphericalBoundary(
      { x: 20 - index / 1000, y: index % 3, z: 0 },
      { x: 100, y: 5, z: 2 },
      boundary,
    );

    assert.ok(
      radiusOf(result.position) <= boundary.radius - boundary.epsilon + 1e-9,
    );
  }
});

test("preserves non-outward components across arbitrary boundary directions", () => {
  let seed = 0x2f6e2b1;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  for (let index = 0; index < 2000; index += 1) {
    const position = {
      x: (random() * 2 - 1) * 30,
      y: (random() * 2 - 1) * 30,
      z: (random() * 2 - 1) * 30,
    };
    const velocity = {
      x: (random() * 2 - 1) * 1e7,
      y: (random() * 2 - 1) * 1e7,
      z: (random() * 2 - 1) * 1e7,
    };
    const positionRadius = radiusOf(position);
    if (positionRadius === 0) continue;
    const normal = {
      x: position.x / positionRadius,
      y: position.y / positionRadius,
      z: position.z / positionRadius,
    };
    const radialBefore =
      velocity.x * normal.x +
      velocity.y * normal.y +
      velocity.z * normal.z;
    const tangentBefore = {
      x: velocity.x - normal.x * radialBefore,
      y: velocity.y - normal.y * radialBefore,
      z: velocity.z - normal.z * radialBefore,
    };

    const result = applySphericalBoundary(position, velocity, boundary);
    const radialAfter =
      result.velocity.x * normal.x +
      result.velocity.y * normal.y +
      result.velocity.z * normal.z;
    const tangentAfter = {
      x: result.velocity.x - normal.x * radialAfter,
      y: result.velocity.y - normal.y * radialAfter,
      z: result.velocity.z - normal.z * radialAfter,
    };

    assert.ok(
      radiusOf(result.position) <= boundary.radius - boundary.epsilon + 1e-9,
    );
    assert.ok(radialAfter <= Math.max(0, radialBefore) + 1e-7);
    assert.ok(Math.abs(tangentAfter.x - tangentBefore.x) < 1e-7);
    assert.ok(Math.abs(tangentAfter.y - tangentBefore.y) < 1e-7);
    assert.ok(Math.abs(tangentAfter.z - tangentBefore.z) < 1e-7);
    if (radialBefore <= 0) assert.equal(result.velocity, velocity);
  }
});

test("normalizes diagonal movement to the configured maximum speed", () => {
  const state = createFlightState();
  const next = stepFlight(
    state,
    { moveRight: 1, moveForward: 1, moveUp: 1, thrust: 0 },
    1,
    { ...config, accelRate: 100, boundary: { ...boundary, radius: 100 } },
  );

  assert.ok(speedOf(next.velocity) <= config.maxSpeed + 1e-9);
  assert.ok(Math.abs(Math.abs(next.velocity.x) - Math.abs(next.velocity.y)) < 1e-9);
  assert.ok(Math.abs(Math.abs(next.velocity.y) - Math.abs(next.velocity.z)) < 1e-9);
});

test("brakes exponentially and snaps sufficiently slow motion to rest", () => {
  let state = createFlightState({ velocity: { x: 3, y: -2, z: 1 } });
  const idle = { moveRight: 0, moveForward: 0, moveUp: 0, thrust: 0 };

  const first = stepFlight(state, idle, 1 / 60, config);
  assert.ok(speedOf(first.velocity) < speedOf(state.velocity));
  assert.ok(speedOf(first.velocity) > 0);

  state = first;
  for (let index = 0; index < 600; index += 1) {
    state = stepFlight(state, idle, 1 / 60, config);
  }
  assert.deepEqual(state.velocity, { x: 0, y: 0, z: 0 });
});

test("stepFlight keeps extreme outward motion inside the playable sphere", () => {
  const state = createFlightState({
    position: { x: 9.9998, y: 0, z: 0 },
    velocity: { x: 1e9, y: 4, z: -3 },
  });
  const next = stepFlight(
    state,
    { moveRight: 1, moveForward: 0, moveUp: 0, thrust: 0 },
    1 / 60,
    config,
  );

  assert.ok(radiusOf(next.position) <= boundary.radius - boundary.epsilon + 1e-9);
  assert.ok(next.velocity.x <= 1e-9);
});

test("keeps Number.MAX_VALUE velocity finite and bounded", () => {
  const next = stepFlight(
    createFlightState({
      position: { x: 9.5, y: 0.25, z: -0.5 },
      velocity: {
        x: Number.MAX_VALUE,
        y: Number.MAX_VALUE,
        z: Number.MAX_VALUE,
      },
    }),
    { moveRight: 0, moveForward: 0, moveUp: 0, thrust: 0 },
    1 / 60,
    config,
  );

  assert.ok(Object.values(next.position).every(Number.isFinite));
  assert.ok(Object.values(next.velocity).every(Number.isFinite));
  assert.ok(radiusOf(next.position) <= boundary.radius - boundary.epsilon + 1e-9);
  assert.ok(speedOf(next.velocity) <= config.maxSpeed + 1e-9);
});

const simulate = (frequency) => {
  let state = createFlightState();
  const input = { moveRight: 0.6, moveForward: 0.8, moveUp: 0, thrust: 0 };
  for (let index = 0; index < frequency * 2; index += 1) {
    state = stepFlight(state, input, 1 / frequency, {
      ...config,
      boundary: { ...boundary, radius: 100, softStart: 90 },
    });
  }
  return state;
};

test("30, 60, and 120 Hz simulations stay consistent", () => {
  const at30 = simulate(30);
  const at60 = simulate(60);
  const at120 = simulate(120);

  for (const candidate of [at30, at60]) {
    assert.ok(Math.abs(candidate.velocity.x - at120.velocity.x) < 1e-9);
    assert.ok(Math.abs(candidate.velocity.z - at120.velocity.z) < 1e-9);
    assert.ok(Math.abs(candidate.position.x - at120.position.x) < 0.12);
    assert.ok(Math.abs(candidate.position.z - at120.position.z) < 0.12);
  }
});

const simulateRelease = (frequency) => {
  let state = createFlightState();
  const moving = { moveRight: 0.6, moveForward: 0.8, moveUp: 0, thrust: 0 };
  const idle = { moveRight: 0, moveForward: 0, moveUp: 0, thrust: 0 };
  for (let index = 0; index < frequency; index += 1) {
    state = stepFlight(state, moving, 1 / frequency, {
      ...config,
      boundary: { ...boundary, radius: 100, softStart: 90 },
    });
  }
  for (let index = 0; index < frequency * 2; index += 1) {
    state = stepFlight(state, idle, 1 / frequency, {
      ...config,
      boundary: { ...boundary, radius: 100, softStart: 90 },
    });
  }
  return state;
};

test("release and rest stay consistent at 30, 60, and 120 Hz", () => {
  const states = [simulateRelease(30), simulateRelease(60), simulateRelease(120)];
  for (const state of states) {
    assert.deepEqual(state.velocity, { x: 0, y: 0, z: 0 });
  }
  for (const candidate of states.slice(0, 2)) {
    assert.ok(Math.abs(candidate.position.x - states[2].position.x) < 0.12);
    assert.ok(Math.abs(candidate.position.z - states[2].position.z) < 0.12);
  }
});

test("boundary collision stays consistent at 30, 60, and 120 Hz", () => {
  const simulateCollision = (frequency) => {
    let state = createFlightState({ position: { x: 9.5, y: 0, z: 0 } });
    const input = { moveRight: 1, moveForward: 0, moveUp: 0.5, thrust: 0 };
    for (let index = 0; index < frequency; index += 1) {
      state = stepFlight(state, input, 1 / frequency, config);
    }
    return state;
  };
  const states = [simulateCollision(30), simulateCollision(60), simulateCollision(120)];
  for (const state of states) {
    assert.ok(radiusOf(state.position) <= boundary.radius - boundary.epsilon + 1e-9);
  }
  for (const candidate of states.slice(0, 2)) {
    assert.ok(Math.abs(candidate.position.x - states[2].position.x) < 0.12);
    assert.ok(Math.abs(candidate.position.y - states[2].position.y) < 0.12);
  }
});

test("rejects a non-finite or negative timestep", () => {
  const state = createFlightState();
  const input = { moveRight: 0, moveForward: 0, moveUp: 0, thrust: 0 };

  assert.throws(() => stepFlight(state, input, Number.NaN, config), RangeError);
  assert.throws(() => stepFlight(state, input, -1 / 60, config), RangeError);
  assert.throws(() => stepFlight(state, input, Infinity, config), RangeError);
});

test("clamps Number.MAX_VALUE timestep to bounded frame work", () => {
  const state = createFlightState();
  const input = { moveRight: 0.6, moveForward: 0.8, moveUp: 0, thrust: 0 };
  const expected = stepFlight(state, input, 0.25, config);
  const startedAt = performance.now();

  const actual = stepFlight(state, input, Number.MAX_VALUE, config);

  assert.deepEqual(actual, expected);
  assert.ok(performance.now() - startedAt < 1000);
});
