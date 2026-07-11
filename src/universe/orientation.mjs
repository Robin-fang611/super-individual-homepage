const normalizeQuaternion = (quaternion) => {
  const length =
    Math.hypot(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w,
    ) || 1;
  return {
    x: quaternion.x / length,
    y: quaternion.y / length,
    z: quaternion.z / length,
    w: quaternion.w / length,
  };
};

const multiply = (left, right) =>
  normalizeQuaternion({
    x:
      left.w * right.x +
      left.x * right.w +
      left.y * right.z -
      left.z * right.y,
    y:
      left.w * right.y -
      left.x * right.z +
      left.y * right.w +
      left.z * right.x,
    z:
      left.w * right.z +
      left.x * right.y -
      left.y * right.x +
      left.z * right.w,
    w:
      left.w * right.w -
      left.x * right.x -
      left.y * right.y -
      left.z * right.z,
  });

const axisAngle = (axis, angle) => {
  const halfAngle = angle / 2;
  const scale = Math.sin(halfAngle);
  return {
    x: axis.x * scale,
    y: axis.y * scale,
    z: axis.z * scale,
    w: Math.cos(halfAngle),
  };
};

const dot = (left, right) =>
  left.x * right.x + left.y * right.y + left.z * right.z;

const cross = (left, right) => ({
  x: left.y * right.z - left.z * right.y,
  y: left.z * right.x - left.x * right.z,
  z: left.x * right.y - left.y * right.x,
});

const normalizeVector = (vector) => {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length < Number.EPSILON) return null;
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
};

const rotateVector = (quaternion, vector) => {
  const imaginary = {
    x: quaternion.x,
    y: quaternion.y,
    z: quaternion.z,
  };
  const firstCross = cross(imaginary, vector);
  const secondCross = cross(imaginary, firstCross);
  return {
    x: vector.x + 2 * (quaternion.w * firstCross.x + secondCross.x),
    y: vector.y + 2 * (quaternion.w * firstCross.y + secondCross.y),
    z: vector.z + 2 * (quaternion.w * firstCross.z + secondCross.z),
  };
};

export const identityQuaternion = () => ({ x: 0, y: 0, z: 0, w: 1 });

export function applyLookDelta(
  quaternion,
  lookX,
  lookY,
  sensitivity,
) {
  const yaw = axisAngle({ x: 0, y: 1, z: 0 }, -lookX * sensitivity);
  const pitch = axisAngle({ x: 1, y: 0, z: 0 }, -lookY * sensitivity);
  return multiply(multiply(quaternion, yaw), pitch);
}

export function forwardFromQuaternion(quaternion) {
  return {
    x: -2 * (quaternion.x * quaternion.z + quaternion.w * quaternion.y),
    y: -2 * (quaternion.y * quaternion.z - quaternion.w * quaternion.x),
    z:
      -(1 - 2 * (quaternion.x * quaternion.x + quaternion.y * quaternion.y)),
  };
}

export function stabilizeRoll(quaternion, comfortUp, dt, rate) {
  const normalized = normalizeQuaternion(quaternion);
  const forward = normalizeVector(forwardFromQuaternion(normalized));
  const currentUp = rotateVector(normalized, { x: 0, y: 1, z: 0 });
  const projectOntoViewPlane = (vector) =>
    normalizeVector({
      x: vector.x - forward.x * dot(vector, forward),
      y: vector.y - forward.y * dot(vector, forward),
      z: vector.z - forward.z * dot(vector, forward),
    });
  const from = projectOntoViewPlane(currentUp);
  const to = projectOntoViewPlane(comfortUp);

  if (!from || !to) return normalized;

  const angle = Math.atan2(
    dot(forward, cross(from, to)),
    dot(from, to),
  );
  const correction = angle * (1 - Math.exp(-rate * dt));
  return multiply(axisAngle(forward, correction), normalized);
}
