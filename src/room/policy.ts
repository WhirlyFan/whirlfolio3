export type Quality = 'auto' | 'low';
export function getPixelRatio(requested: number, quality: Quality, width: number): number {
  return Math.min(
    Math.max(Number.isFinite(requested) ? requested : 1, 0.5),
    quality === 'low' ? 1 : width < 640 ? 1.25 : 1.5,
  );
}
export function shouldAnimate({
  hidden,
  paused,
  reducedMotion,
}: {
  hidden: boolean;
  paused: boolean;
  reducedMotion: boolean;
}): boolean {
  return !hidden && !paused && !reducedMotion;
}
