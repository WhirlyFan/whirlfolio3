import { birdFlightRoutes, sampleBirdFlight } from './bird-flight';

/** Authored poses plus quiet holds, not a continuously repeating movie. Seconds use the room clock. */
const idleClips = {
  blink: { frames: [0, 1, 0], seconds: [0.3, 0.42] },
  'look-up': { frames: [0, 2, 2, 2, 0], seconds: [1.8, 3.2] },
  'look-around': { frames: [0, 3, 3, 0], seconds: [1.6, 2.8] },
  preen: { frames: [0, 4, 5, 6, 5, 6, 7, 0], seconds: [3.4, 4.8] },
  fluff: { frames: [0, 8, 9, 8, 9, 8, 0], seconds: [1.5, 2.2] },
  stretch: { frames: [0, 10, 11, 11, 11, 12, 0], seconds: [3.2, 4.2] },
} as const;
type IdleAction = keyof typeof idleClips;
type BirdAction = IdleAction | 'rest' | 'depart' | 'away' | 'return';
const idleActions = Object.keys(idleClips) as IdleAction[];
const quietSeconds = [5, 12] as const;
const flightCooldownSeconds = [120, 210] as const;
const travelSeconds = 3;

/** One seed per room visit. Random choices happen only at action boundaries, never per frame. */
export function createBirdBehavior(seed = Math.floor(Math.random() * 0x100000000)) {
  let randomState = seed >>> 0;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 0x100000000;
  };
  const between = ([min, max]: readonly [number, number]) => min + random() * (max - min);
  let bag: IdleAction[] = [];
  let recent: IdleAction[] = [];
  let action: BirdAction = 'rest';
  let startedAt = 0;
  let duration = between([2, 4]);
  let flightAt = between(flightCooldownSeconds);
  let previousTime = 0;
  let routeBag: number[] = [];
  let departureRoute = -1;
  let returnRoute = 0;
  let perchDirection = 1;

  return function poseAt(timeSeconds: number) {
    const time = Math.max(0, timeSeconds);
    // A clock rewind replays the same visit without retaining an unbounded event history.
    if (time < previousTime) {
      randomState = seed >>> 0;
      bag = [];
      recent = [];
      action = 'rest';
      startedAt = 0;
      duration = between([2, 4]);
      flightAt = between(flightCooldownSeconds);
      routeBag = [];
      departureRoute = -1;
      returnRoute = 0;
      perchDirection = 1;
    }
    previousTime = time;
    while (time >= startedAt + duration) {
      startedAt += duration;
      if (action === 'depart') {
        action = 'away';
        duration = between([8, 16]);
        const alternatives = birdFlightRoutes.map((_, i) => i).filter((i) => i !== departureRoute);
        returnRoute = alternatives[Math.floor(random() * alternatives.length)];
      } else if (action === 'away') {
        action = 'return';
        duration = travelSeconds;
      } else if (action === 'rest' && startedAt >= flightAt) {
        action = 'depart';
        duration = travelSeconds;
        if (!routeBag.length) routeBag = birdFlightRoutes.map((_, i) => i);
        const eligible = routeBag.filter((i) => i !== departureRoute);
        departureRoute = eligible[Math.floor(random() * eligible.length)];
        routeBag = routeBag.filter((i) => i !== departureRoute);
      } else if (action === 'rest') {
        if (!bag.length) bag = [...idleActions];
        const eligible = bag.filter((candidate) => !recent.includes(candidate));
        const next = eligible[Math.floor(random() * eligible.length)];
        bag = bag.filter((candidate) => candidate !== next);
        recent = [...recent.slice(-1), next];
        action = next;
        duration = between(idleClips[next].seconds);
      } else {
        if (action === 'return') {
          flightAt = startedAt + between(flightCooldownSeconds);
          perchDirection = sampleBirdFlight(returnRoute, 0, true).direction;
        }
        action = 'rest';
        duration = between(quietSeconds);
      }
    }
    const progress = (time - startedAt) / duration;
    const flying = action === 'depart' || action === 'return';
    const distanceProgress =
      action === 'depart'
        ? progress
        : action === 'return'
          ? 1 - progress
          : action === 'away'
            ? 1
            : 0;
    const flight = sampleBirdFlight(
      action === 'return' ? returnRoute : Math.max(0, departureRoute),
      distanceProgress,
      action === 'return',
    );
    const clip = action in idleClips ? idleClips[action as IdleAction] : undefined;
    const frame = flying
      ? 13 + (Math.floor((time - startedAt) * 8) % 3)
      : clip
        ? clip.frames[Math.min(clip.frames.length - 1, Math.floor(progress * clip.frames.length))]
        : 0;
    return {
      action,
      startedAt,
      frame,
      ...flight,
      breathScale: flying ? 1 : 1 + ((1 - Math.cos((time * Math.PI) / 2)) / 2) * 0.018,
      direction: flying ? flight.direction : perchDirection,
      visible: action !== 'away',
      flying,
    };
  };
}
