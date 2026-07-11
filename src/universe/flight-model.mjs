import { rotateVector } from "./orientation.mjs";

const MAX_STEP_SECONDS = 1 / 60;

const length = (vector) =>
  Math.hypot(vector.x, vector.y, vector.z);

const scale = (vector, factor) => ({
  x: vector.x * factor,
  y: vector.y * factor,
  z: vector.z * factor,
});

const add = (left, right) => ({
  x: left.x + right.x,
  y: left.y + right.y,
  z: left.z + right.z,
});

const dot = (left, right) =>
  left.x * right.x + left.y * right.y + left.z * right.z;

const smoothstep = (start, end, value) => {
  const progress = Math.min(
    1,
    Math.max(0, (value - start) / (end - start)),
  );
  return progress * progress * (3 - 2 * progress);
};

export function applySphericalBoundary(
  position,
  velocity,
  { radius, softStart, epsilon },
) {
  if (
    ![radius, softStart, epsilon].every(Number.isFinite) ||
    radius <= 0 ||
    softStart < 0 ||
    radius <= softStart ||
    epsilon < 0 ||
    epsilon >= radius
  ) {
    throw new RangeError("invalid spherical boundary configuration");
  }
  const positionRadius = length(position);
  const normal =
    positionRadius > 0
      ? scale(position, 1 / positionRadius)
      : { x: 1, y: 0, z: 0 };
  const radialSpeed = dot(velocity, normal);

  let nextVelocity = velocity;
  if (radialSpeed > 0) {
    const tangent = add(velocity, scale(normal, -radialSpeed));
    const outwardGain = smoothstep(radius, softStart, positionRadius);
    nextVelocity = add(
      tangent,
      scale(normal, radialSpeed * outwardGain),
    );
  }

  let nextPosition = position;
  const maximumRadius = radius - epsilon;
  if (positionRadius > maximumRadius) {
    nextPosition = scale(normal, maximumRadius);
    const remainingOutwardSpeed = dot(nextVelocity, normal);
    if (remainingOutwardSpeed > 0) {
      nextVelocity = add(
        nextVelocity,
        scale(normal, -remainingOutwardSpeed),
      );
    }
  }

  return { position: nextPosition, velocity: nextVelocity };
}

export function createFlightState(options = {}) {
  return {
    position: options.position ?? { x: 0, y: 0, z: 0 },
    velocity: options.velocity ?? { x: 0, y: 0, z: 0 },
    quaternion: options.quaternion ?? { x: 0, y: 0, z: 0, w: 1 },
  };
}

const stepOnce = (state, input, dt, config) => {
  const forward = rotateVector(
    state.quaternion,
    { x: 0, y: 0, z: -1 },
  );
  const right = rotateVector(
    state.quaternion,
    { x: 1, y: 0, z: 0 },
  );
  const up = rotateVector(
    state.quaternion,
    { x: 0, y: 1, z: 0 },
  );
  let direction = add(
    add(
      scale(right, input.moveRight ?? 0),
      scale(
        forward,
        (input.moveForward ?? 0) +
          (input.thrust ?? 0) * config.thrustScale,
      ),
    ),
    scale(up, input.moveUp ?? 0),
  );
  const directionMagnitude = length(direction);
  if (directionMagnitude > 1) {
    direction = scale(direction, 1 / directionMagnitude);
  }

  const targetVelocity = scale(direction, config.maxSpeed);
  const responseRate =
    directionMagnitude > 0 ? config.accelRate : config.stopRate;
  const responseGain = 1 - Math.exp(-responseRate * dt);
  let velocity = add(
    state.velocity,
    scale(add(targetVelocity, scale(state.velocity, -1)), responseGain),
  );
  if (
    directionMagnitude === 0 &&
    length(velocity) < config.stopEpsilon
  ) {
    velocity = { x: 0, y: 0, z: 0 };
  }

  const predictedPosition = add(state.position, scale(velocity, dt));
  const bounded = applySphericalBoundary(
    predictedPosition,
    velocity,
    config.boundary,
  );
  return {
    ...state,
    position: bounded.position,
    velocity: bounded.velocity,
  };
};

export function stepFlight(state, input, dt, config) {
  if (!Number.isFinite(dt) || dt < 0) {
    throw new RangeError("dt must be a finite, non-negative number");
  }
  const stepCount = Math.max(1, Math.ceil(dt / MAX_STEP_SECONDS));
  const stepDuration = dt / stepCount;
  let nextState = state;
  for (let index = 0; index < stepCount; index += 1) {
    nextState = stepOnce(nextState, input, stepDuration, config);
  }
  return nextState;
}
