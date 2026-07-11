import { rotateVector } from "./orientation.mjs";

const MAX_STEP_SECONDS = 1 / 60;
const MAX_FRAME_SECONDS = 0.25;
const MAX_SUBSTEPS = 15;

const measureVector = (vector) => {
  const maximumComponent = Math.max(
    Math.abs(vector.x),
    Math.abs(vector.y),
    Math.abs(vector.z),
  );
  if (maximumComponent === 0) {
    return { magnitude: 0, unit: null };
  }
  const scaled = {
    x: vector.x / maximumComponent,
    y: vector.y / maximumComponent,
    z: vector.z / maximumComponent,
  };
  const scaledMagnitude = Math.hypot(scaled.x, scaled.y, scaled.z);
  return {
    magnitude: maximumComponent * scaledMagnitude,
    unit: {
      x: scaled.x / scaledMagnitude,
      y: scaled.y / scaledMagnitude,
      z: scaled.z / scaledMagnitude,
    },
  };
};

const length = (vector) => measureVector(vector).magnitude;

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

const clampMagnitude = (vector, maximumMagnitude) => {
  const measured = measureVector(vector);
  if (!measured.unit || measured.magnitude <= maximumMagnitude) {
    return vector;
  }
  return scale(measured.unit, maximumMagnitude);
};

const restoreFiniteComponent = (component, magnitude) => {
  if (component === 0) return 0;
  if (Math.abs(component) > Number.MAX_VALUE / magnitude) {
    return Math.sign(component) * Number.MAX_VALUE;
  }
  return component * magnitude;
};

const restoreFiniteVector = (vector, magnitude) => ({
  x: restoreFiniteComponent(vector.x, magnitude),
  y: restoreFiniteComponent(vector.y, magnitude),
  z: restoreFiniteComponent(vector.z, magnitude),
});

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
  const measuredPosition = measureVector(position);
  const positionRadius = measuredPosition.magnitude;
  const normal = measuredPosition.unit ?? { x: 1, y: 0, z: 0 };
  const maximumRadius = radius - epsilon;
  let nextPosition = position;
  if (positionRadius > maximumRadius) {
    nextPosition = scale(normal, maximumRadius);
  }

  const velocityMagnitude = Math.max(
    Math.abs(velocity.x),
    Math.abs(velocity.y),
    Math.abs(velocity.z),
    1,
  );
  const scaleVelocityComponent = (component) =>
    Math.abs(component) === velocityMagnitude
      ? Math.sign(component)
      : component / velocityMagnitude;
  const scaledVelocity = {
    x: scaleVelocityComponent(velocity.x),
    y: scaleVelocityComponent(velocity.y),
    z: scaleVelocityComponent(velocity.z),
  };
  const scaledRadialSpeed = dot(scaledVelocity, normal);
  if (
    positionRadius < softStart ||
    scaledRadialSpeed <= 0
  ) {
    return { position: nextPosition, velocity };
  }

  const tangent = add(
    scaledVelocity,
    scale(normal, -scaledRadialSpeed),
  );
  const outwardGain =
    positionRadius > maximumRadius
      ? 0
      : smoothstep(radius, softStart, positionRadius);
  const nextScaledVelocity = add(
    tangent,
    scale(normal, scaledRadialSpeed * outwardGain),
  );
  return {
    position: nextPosition,
    velocity: restoreFiniteVector(nextScaledVelocity, velocityMagnitude),
  };
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
  const measuredDirection = measureVector(direction);
  const directionMagnitude = measuredDirection.magnitude;
  if (directionMagnitude > 1) {
    direction = measuredDirection.unit;
  }

  const targetVelocity = scale(direction, config.maxSpeed);
  const responseRate =
    directionMagnitude > 0 ? config.accelRate : config.stopRate;
  const responseGain = 1 - Math.exp(-responseRate * dt);
  const currentVelocity = clampMagnitude(state.velocity, config.maxSpeed);
  let velocity = clampMagnitude(add(
    currentVelocity,
    scale(add(targetVelocity, scale(currentVelocity, -1)), responseGain),
  ), config.maxSpeed);
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
  const simulatedDuration = Math.min(dt, MAX_FRAME_SECONDS);
  const stepCount = Math.min(
    MAX_SUBSTEPS,
    Math.max(1, Math.ceil(simulatedDuration / MAX_STEP_SECONDS)),
  );
  const stepDuration = simulatedDuration / stepCount;
  let nextState = state;
  for (let index = 0; index < stepCount; index += 1) {
    nextState = stepOnce(nextState, input, stepDuration, config);
  }
  return nextState;
}
