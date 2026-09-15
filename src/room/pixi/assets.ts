import { asset } from '../../content/portfolio';
import { ImageSource, Texture } from 'pixi.js';

/** Versioned production art. Source references and drafts are kept outside the public repository. */
export const artwork = {
  background: asset('art/summer-room-v11.svg'),
  floorReceiver: asset('art/floor-receiver-v2.webp'),
  tripod: asset('art/tripod-reference-v4.webp'),
  sleeper: asset('art/sleeper-joint-v1.svg'),
  curtain: asset('art/curtain-v1.webp'),
  fan: asset('art/fan-empty-v2.svg'),
  foliage: asset('art/foliage-atlas-v1.webp'),
  trailing: asset('art/trailing-atlas-v1.webp'),
  bird: asset('art/dove-atlas-v1.webp'),
  gull: asset('photos/gull-room.webp'),
  dovePhoto: asset('photos/dove-room.webp'),
};

// Coordinates use a fixed illustration space, independent of screen pixel density.
export const sceneSize = { width: 1600, height: 900 };
export const placement = {
  curtain: { x: 330, y: -10, width: 323.333, height: 485 },
  fan: { x: 1095, y: 510, width: 145 },
  monitor: { x: 1325, y: 337, width: 205, height: 186 },
  bird: { x: 902, y: 439, width: 104 },
  plants: [
    { x: 347, y: 529, width: 225, height: 260, cell: 0 },
    { x: 1235, y: 474, width: 205, height: 207, cell: 1 },
    { x: 1287, y: 512, width: 92, height: 105, cell: 1 },
  ],
};

export async function loadArtwork(signal: AbortSignal) {
  const names = Object.keys(artwork) as (keyof typeof artwork)[];
  // Wait for all decoders before releasing results; a late bitmap must not escape cleanup.
  const results = await Promise.allSettled(
    names.map(async (name) => {
      const response = await fetch(artwork[name], { signal });
      if (!response.ok) throw new Error(`Artwork unavailable: ${name}`);
      // WebGL ignores UNPACK_PREMULTIPLY_ALPHA_WEBGL for ImageBitmap resources.
      // Prepare premultiplied colors while decoding, before Pixi blends the texture.
      const bitmap = await decodeArtwork(await response.blob());
      return { name, bitmap };
    }),
  );
  const loaded = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  const failed = results.find((result) => result.status === 'rejected');
  if (signal.aborted || failed) {
    loaded.forEach(({ bitmap }) => bitmap.close());
    throw signal.aborted
      ? new DOMException('Room canceled', 'AbortError')
      : (failed as PromiseRejectedResult).reason;
  }
  const textures = Object.fromEntries(
    loaded.map(({ name, bitmap }) => [
      name,
      new Texture({
        source: new ImageSource({
          resource: bitmap,
          alphaMode: 'premultiplied-alpha',
        }),
      }),
    ]),
  ) as Record<keyof typeof artwork, Texture>;
  let disposed = false;
  return {
    textures,
    dispose() {
      if (disposed) return;
      disposed = true;
      Object.values(textures).forEach((texture) => texture.destroy(true));
      loaded.forEach(({ bitmap }) => bitmap.close());
    },
  };
}

/** Chromium decodes embedded SVG layers through Image, not directly from a Blob. */
async function decodeArtwork(blob: Blob) {
  const options: ImageBitmapOptions = { premultiplyAlpha: 'premultiply' };
  if (!blob.type.includes('svg')) return createImageBitmap(blob, options);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return await createImageBitmap(image, options);
  } finally {
    URL.revokeObjectURL(url);
  }
}
