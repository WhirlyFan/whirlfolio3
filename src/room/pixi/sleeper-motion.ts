import { windowGust } from './window-wind';

/** Local room pixels in the 550×550 joint painting; supported limbs/chair are rigid. */
export function seatedRoomOffset(x: number, y: number, timeSeconds: number, _fanSpeed: 0 | 1 | 2) {
  const cloth = Math.max(0, 1 - ((x - 190) / 65) ** 2 - ((y - 160) / 75) ** 2);
  const hair = Math.max(0, 1 - ((x - 280) / 70) ** 2 - ((y - 30) / 27) ** 2);
  const breath = (1 - Math.cos((timeSeconds * Math.PI * 2) / 4.8)) / 2;
  const breeze = windowGust(timeSeconds, 0.18);
  return { x: cloth * breath * -1.5 + hair * breeze * 5.2, y: cloth * breath * -8 };
}
