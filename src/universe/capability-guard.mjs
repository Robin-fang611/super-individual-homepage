export function constrainProfile(profile, capabilities = {}) {
  const constrained = { ...profile };

  if (!capabilities.webgl2 || !capabilities.floatTextures) {
    constrained.inkMode = "slices";
    constrained.inkSteps = 0;
  }

  if (Number.isFinite(capabilities.maxTextureSize) && capabilities.maxTextureSize < 4096) {
    constrained.dprMax = Math.min(constrained.dprMax, 1.25);
  }

  return Object.freeze(constrained);
}
