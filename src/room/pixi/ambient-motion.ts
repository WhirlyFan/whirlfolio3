import type { Quality } from '../policy';
import { windowGust } from './window-wind';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

/** All time comes from the room clock: no independent timers or random frame state. */
export function birdPose(timeSeconds: number) {
  const phase = timeSeconds % 36;
  const departing = phase >= 20 && phase < 23;
  const returning = phase >= 29 && phase < 32;
  const flying = departing || returning;
  const progress = departing ? (phase - 20) / 3 : returning ? (32 - phase) / 3 : 0;
  const distance = smooth(progress);
  const blink = phase % 6.2 >= 3 && phase % 6.2 < 3.18;
  const curious = phase % 10 >= 7 && phase % 10 < 8.8;
  return {
    frame: flying ? 3 + (Math.floor(timeSeconds * 9) % 3) : blink ? 1 : curious ? 2 : 0,
    x: -330 * distance,
    y: -240 * distance - 35 * Math.sin(Math.PI * progress),
    scale: 1 - 0.8 * distance,
    // Small chest rise around the fixed feet makes the perch visibly alive
    // between blinks. Biological rhythm, not a second wind/timer source.
    breathScale: flying ? 1 : 1 + ((1 - Math.cos((phase * Math.PI) / 2)) / 2) * 0.018,
    alpha: 1 - smooth((progress - 0.7) / 0.3),
    direction: returning ? -1 : 1,
    visible: phase < 23 || phase >= 29,
    flying,
  };
}

/** Roots stay in their painted pots; the canopy bends more toward the leaf tips. */
export function foliageOffset(
  verticalFraction: number,
  timeSeconds: number,
  plantIndex: number,
  fanSpeed: 0 | 1 | 2,
) {
  const free = 1 - clamp(verticalFraction);
  const fanExposure = plantIndex === 1 ? 1 : 0.18;
  const amplitude = 11.5 * (1 + fanSpeed * 0.065 * fanExposure);
  return free ** 1.7 * amplitude * windowGust(timeSeconds, 0.06 + plantIndex * 0.05 + free * 0.06);
}

/** Hanging stems keep their pot-side origin fixed and describe a small, visible arc at the tips. */
export function trailingFoliageOffset(
  distanceFromRoot: number,
  timeSeconds: number,
  vineIndex: number,
) {
  const free = smooth(distanceFromRoot);
  if (free === 0) return { x: 0, y: 0 };
  const gust = windowGust(timeSeconds, 0.12 + vineIndex * 0.06 + free * 0.04);
  return {
    x: free * 12 * gust,
    y: free * 2.6 * gust,
  };
}

/** The outdoor branch is anchored at its upper-right woody end. */
export function outdoorBranchOffset(distanceFromRoot: number, timeSeconds: number) {
  const free = smooth(distanceFromRoot);
  if (free === 0) return { x: 0, y: 0 };
  const gust = windowGust(timeSeconds, free * 0.04);
  return {
    x: free * 8.7 * gust,
    y: free * 2.1 * gust,
  };
}

export const maxMotes = 18;
export function moteCount(width: number, quality: Quality) {
  return quality === 'low' ? 4 : width < 640 ? 6 : maxMotes;
}

export function motePose(index: number, timeSeconds: number) {
  // Interleave desk/window lanes: even the first four cover the cropped phone view.
  const lane = [4, 1, 5, 2, 3, 0][index % 6];
  const phase = (timeSeconds / 31 + index * 0.173 + 0.37) % 1;
  return {
    x: 520 + lane * 145 + phase * 180 + windowGust(timeSeconds, 0.1) * 9,
    y: 180 + (index % 2) * 90 + Math.floor(index / 6) * 80 + phase * 70,
    // Fade completely at wrap; no sudden particle teleport in a sunbeam.
    alpha: Math.sin(Math.PI * phase) ** 2 * (0.52 + (index % 3) * 0.03),
  };
}
