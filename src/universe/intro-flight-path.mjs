// 纯向量数学，不依赖 THREE，方便测试
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function lerp(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
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

function smoothstep(a, b, value) {
  const t = clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * 生成开场飞行路径：逐段直线掠过每一颗星前方，最后 settle 到 current 星正面。
 * 段时长按弧长分配；末尾 settle 段减速到 0，与 handoff 无缝衔接。
 * 纯向量采样，不含 THREE。
 */
export function buildIntroFlightPath({ start, stars, boundaryRadius = Infinity }) {
  // 掠过顺序：从远处节点到当前星（sceneStars 是 current 优先，反转得到 远→近）
  const ordered = [...stars].reverse();
  const current = stars.find((star) => star.current) ?? stars[0];
  if (!current) {
    return { durationMs: 0, pointAt: () => ({ position: start, lookAt: { x: 0, y: 0, z: -1 } }) };
  }

  // 控制点：起点 → 每颗星的飞掠点 → current 星正面
  const controlPoints = [start];
  for (const star of ordered) {
    const direction = {
      x: start.x - star.position.x,
      y: start.y - star.position.y,
      z: start.z - star.position.z,
    };
    const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
    let point = {
      x: star.position.x + (direction.x / length) * 1.8,
      y: star.position.y + (direction.y / length) * 1.8,
      z: star.position.z + (direction.z / length) * 1.8,
    };
    const dist = Math.hypot(point.x, point.y, point.z);
    if (dist > boundaryRadius) {
      const scale = boundaryRadius / dist;
      point = { x: point.x * scale, y: point.y * scale, z: point.z * scale };
    }
    controlPoints.push(point);
  }
  const finalPosition = {
    x: current.position.x - 0.18,
    y: current.position.y - 0.02,
    z: current.position.z - 0.35,
  };
  controlPoints.push(finalPosition);

  // 段弧长
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

  // 速度曲线：前 85% 匀速，后 15% 减速到 0（smoothstep 缓出）
  const SETTLE_RATIO = 0.15;
  const settleStart = 1 - SETTLE_RATIO;

  // 归一化速度（弧长占比/时间占比）
  const baseSpeed = 1 / settleStart; // 匀速段速度（占总弧长比例 per 时间比例）
  function distanceAt(progress) {
    if (progress < settleStart) return progress * settleStart * totalLength * baseSpeed;
    const settleProgress = (progress - settleStart) / SETTLE_RATIO;
    const settleDistance = totalLength * SETTLE_RATIO * (2 * settleProgress - settleProgress * settleProgress);
    return totalLength * settleStart + settleDistance;
  }
  // distanceAt(0)=0, distanceAt(settleStart)=totalLength*settleStart, distanceAt(1)=totalLength*settleStart + totalLength*SETTLE_RATIO = totalLength ✓

  // 弧长 → 位置：逐段定位 + 线性插值
  const cumulative = [];
  let running = 0;
  for (const length of segmentLengths) {
    running += length;
    cumulative.push(running);
  }

  function positionAt(distance) {
    let segmentIndex = 0;
    while (segmentIndex < cumulative.length - 1 && cumulative[segmentIndex] < distance) {
      segmentIndex += 1;
    }
    const segmentStart = segmentIndex === 0 ? 0 : cumulative[segmentIndex - 1];
    const segmentLength = segmentLengths[segmentIndex];
    const local = segmentLength === 0 ? 0 : clamp((distance - segmentStart) / segmentLength, 0, 1);
    return lerp(controlPoints[segmentIndex], controlPoints[segmentIndex + 1], local);
  }

  function sample(progress) {
    const clamped = clamp(progress, 0, 1);
    const distance = distanceAt(clamped);
    const position = positionAt(distance);

    // lookAt：指向当前段的目标星（段 0 是起点→第一颗星，其余段指向各自星标）
    let segmentIndex = 0;
    while (segmentIndex < cumulative.length - 1 && cumulative[segmentIndex] < distance) {
      segmentIndex += 1;
    }
    const starIndex = Math.min(segmentIndex, ordered.length - 1);
    const lookTarget = ordered[starIndex].position;
    return {
      position,
      lookAt: lookTarget,
      quaternion: lookAtQuaternion(position, lookTarget),
    };
  }

  // 时长：总弧长 × 每单位弧长的毫秒数（速度设定，3 星路径约 8s）
  const durationMs = Math.max(3200, totalLength * 420);

  return { durationMs, pointAt: sample };
}
