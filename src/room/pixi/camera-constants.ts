/** Camera tuning is in seconds and CSS pixels, not frames or device pixels. */
export const cameraTuning = {
  coastSeconds: 0.28,
  springFrequency: 20,
  springDamping: 0.85,
  sampleWindowMs: 100,
  staleSampleMs: 80,
  maxReleaseSpeedPx: 1800,
  maxEdgePullPx: 24,
  edgeResistance: 0.4,
  restDistance: 0.05,
  restSpeed: 0.5,
} as const;
