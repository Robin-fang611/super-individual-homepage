export function captureCameraView(cameraState, activeStarId) {
  return {
    targetFocus: { ...cameraState.targetFocus },
    targetDistance: cameraState.targetDistance,
    baseYaw: cameraState.baseYaw,
    targetPitch: cameraState.targetPitch,
    activeStarId,
  };
}

export function restoreCameraView(cameraState, snapshot) {
  cameraState.targetFocus = { ...snapshot.targetFocus };
  cameraState.targetDistance = snapshot.targetDistance;
  cameraState.baseYaw = snapshot.baseYaw;
  cameraState.targetPitch = snapshot.targetPitch;
  return snapshot.activeStarId;
}
