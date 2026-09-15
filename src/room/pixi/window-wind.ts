/** One room-clock gust, in world-space horizontal direction. Small delays allow material flex. */
export function windowGust(timeSeconds: number, lagSeconds = 0) {
  const phase = (timeSeconds - lagSeconds) * 0.62;
  return Math.sin(phase) * 0.9 + Math.sin(phase * 2 + 0.45) * 0.1;
}
