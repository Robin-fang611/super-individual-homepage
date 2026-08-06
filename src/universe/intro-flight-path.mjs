// 纯向量数学，不依赖 THREE，方便测试
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function catmullRom(points, t) {
  const count = points.length;
  if (count === 1) return points[0];
  const scaled = t * (count - 1);
  const index = Math.min(count - 2, Math.floor(scaled));
  const local = scaled - index;
  const p0 = points[Math.max(0, index - 1)];
  const p1 = points[index];
  const p2 = points[index + 1];
  const p3 = points[Math.min(count - 1, index + 2)];
  const t2 = local * local;
  const t3 = t2 * local;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * local + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * local + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    z: 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * local + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  };
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function lookAtQuaternion(position, target) {
  const forward = {
    x: target.x - position.x,
    y: target.y - position.y,
    z: target.z - position.z,
  };
  const length = Math.hypot(forward.x, forward.y, forward.z) || 1;
  const fx = forward.x / length;
  const fy = forward.y / length;
  const fz = forward.z / length;
  const up = { x: 0, y: 1, z: 0 };
  const rightX = up.y * fz - up.z * fy;
  const rightY = up.z * fx - up.x * fz;
  const rightZ = up.x * fy - up.y * fx;
  const rightLen = Math.hypot(rightX, rightY, rightZ) || 1;
  const rx = rightX / rightLen;
  const ry = rightY / rightLen;
  const rz = rightZ / rightLen;
  const ux = fy * rz - fz * ry;
  const uy = fz * rx - fx * rz;
  const uz = fx * ry - fy * rx;
  const trace = rx + uy + fz;
  let qx, qy, qz, qw;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    qw = 0.25 * s;
    qx = (uz - ry) / s;
    qy = (rx - fz) / s;
    qz = (fy - ux) / s;
  } else if (rx > uy && rx > fz) {
    const s = Math.sqrt(1 + rx - uy - fz) * 2;
    qw = (uz - ry) / s;
    qx = 0.25 * s;
    qy = (ux + ry) / s;
    qz = (rx + fz) / s;
  } else if (uy > fz) {
    const s = Math.sqrt(1 + uy - rx - fz) * 2;
    qw = (rx - fz) / s;
    qx = (ux + ry) / s;
    qy = 0.25 * s;
    qz = (uz + ry) / s;
  } else {
    const s = Math.sqrt(1 + fz - rx - uy) * 2;
    qw = (fy - ux) / s;
    qx = (rx + fz) / s;
    qy = (uz + ry) / s;
    qz = 0.25 * s;
  }
  const norm = Math.hypot(qx, qy, qz, qw) || 1;
  return { x: qx / norm, y: qy / norm, z: qz / norm, w: qw / norm };
}

/**
 * 生成开场飞行路径：掠过每一颗星的前方，最后停在 current 星正面。
 * 纯向量采样，不含 THREE；末尾 settle 段减速到 0，与 handoff 无缝衔接。
 */
export function buildIntroFlightPath({ start, stars, boundaryRadius = Infinity }) {
  const ordered = [...stars].sort((a, b) => (a.current ? -1 : 0) - (b.current ? -1 : 0));
  const current = ordered.find((star) => star.current) ?? ordered[0];
  if (!current) {
    return { durationMs: 0, pointAt: () => ({ position: start, lookAt: { x: 0, y: 0, z: -1 } }) };
  }

  // 飞掠点：每颗星前方 1.6 倍半径处（朝观察者方向偏移），终点为 current 星正面
  const controlPoints = [start];
  for (const star of ordered) {
    const direction = {
      x: start.x - star.position.x,
      y: start.y - star.position.y,
      z: start.z - star.position.z,
    };
    const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
    const offset = 1.6;
    let point = {
      x: star.position.x + (direction.x / length) * offset,
      y: star.position.y + (direction.y / length) * offset,
      z: star.position.z + (direction.z / length) * offset,
    };
    // 钳制在飞行边界内
    const dist = Math.hypot(point.x, point.y, point.z);
    if (dist > boundaryRadius) {
      const scale = boundaryRadius / dist;
      point = { x: point.x * scale, y: point.y * scale, z: point.z * scale };
    }
    controlPoints.push(point);
  }

  // 终点：current 星正面（homeFocus 思路：略靠近观察者、略低）
  const finalPosition = {
    x: current.position.x - 0.18,
    y: current.position.y - 0.02,
    z: current.position.z - 0.35,
  };
  controlPoints.push(finalPosition);

  // 段时长按弧长比例分配，末尾 15% 减速 settle
  const segmentLengths = [];
  let totalLength = 0;
  for (let index = 0; index < controlPoints.length - 1; index += 1) {
    const length = pointDistance(controlPoints[index], controlPoints[index + 1]);
    segmentLengths.push(length);
    totalLength += length;
  }
  if (totalLength === 0) {
    return { durationMs: 0, pointAt: () => ({ position: finalPosition, lookAt: current.position }) };
  }

  const settleRatio = 0.15;
  const settleStart = 1 - settleRatio;
  const speedAt = (progress) => {
    // 前 85% 匀速，后 15% 减速到 0（缓出）
    if (progress < settleStart) return 1;
    const settleProgress = (progress - settleStart) / settleRatio;
    return 1 - settleProgress * settleProgress;
  };

  // 弧长参数化：progress -> 沿路径的距离
  const cumulative = [];
  let running = 0;
  for (const length of segmentLengths) {
    running += length;
    cumulative.push(running);
  }

  function distanceAt(progress) {
    // 先按速度曲线积分得到目标距离（近似：匀速段线性，settle 段减速）
    if (progress < settleStart) {
      return (progress / settleStart) * totalLength * settleStart;
    }
    const settleProgress = (progress - settleStart) / settleRatio;
    const settleDistance = totalLength * settleRatio * (settleProgress * (2 - settleProgress));
    return totalLength * settleStart + settleDistance;
  }

  function sample(progress) {
    const clamped = clamp(progress, 0, 1);
    const targetDistance = distanceAt(clamped);
    let segmentIndex = 0;
    while (segmentIndex < cumulative.length - 1 && cumulative[segmentIndex] < targetDistance) {
      segmentIndex += 1;
    }
    const segmentStart = segmentIndex === 0 ? 0 : cumulative[segmentIndex - 1];
    const segmentLength = segmentLengths[segmentIndex];
    const local = segmentLength === 0 ? 0 : (targetDistance - segmentStart) / segmentLength;
    const position = catmullRom(controlPoints, (segmentIndex + local) / (controlPoints.length - 1));
    const lookTarget = ordered[Math.min(ordered.length - 1, segmentIndex + 1)].position;
    return {
      position,
      lookAt: lookTarget,
      quaternion: lookAtQuaternion(position, lookTarget),
    };
  }

  const speedSum = segmentLengths.reduce((sum, length, index) => {
    const startProgress = index / (controlPoints.length - 1);
    return sum + speedAt(startProgress) * length;
  }, 0);
  const baseDuration = speedSum > 0 ? totalLength / (speedSum / totalLength) : 0;
  const durationMs = Math.max(2600, baseDuration * 900);

  return { durationMs, pointAt: sample };
}
