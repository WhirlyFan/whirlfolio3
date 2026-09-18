# Whirlfolio3

Michael Lee's interactive summer room and portfolio, built with React, Vite, Tailwind CSS, shadcn/ui and PixiJS. The painted room and the readable portfolio share one content source. This is a new application, not a fork of the previous portfolio.

## Run locally

Use Node 24 and pnpm 11.20.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by Vite. Drag or swipe to explore the room, or focus the canvas and use arrow keys. Click the monitor for projects, the bird frames for photography, or the fan to change its speed. Both views share the same navigation: sections at the top on desktop and at the bottom on smaller screens. The Portfolio tab opens the readable page without loading the room engine and restores your reading position when you return.

The labeled Résumé download is always available in that shared navigation, including while the room loads or if its artwork cannot load. It downloads the same PDF as the reading view without leaving the room.

Animation follows the operating system's reduced-motion preference, including changes made while the site is open. Rendering quality is automatic, with capped pixel density on phones. There are no separate fan, pause or detail controls; the painted fan remains clickable. There is no sound. The fan, curtain, plants, bird, sleeper and dust use one room clock; breathing and bird actions have their own rhythms, while wind-driven elements share the window gust.

## Verify

```sh
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm preview
```

Browser tests exercise the actual room using Chromium software rendering. They do not measure performance on a physical low-end phone. Generated comparison paintings in `e2e/fixtures/` are test inputs only and do not ship in the website. `pnpm format` formats code and configuration.

## Update content

- `src/content/portfolio.ts`: profile, experience, projects, education, research, photo captions and links. Add entries here; new information does not require new room objects.
- `public/Michael_Lee_Resume.pdf`: the downloadable résumé. Replace this separately when the résumé changes.
- `public/photos/`: displayed bird photographs and smaller room-frame derivatives. Add photographs and matching entries to the content array.
- `src/components/portfolio/`: shared Projects, Experience, Photography, About and Tags components. The page requests `presentation="editorial"`; room dialogs use the default compact presentation. Each component owns its internal styling; its parent owns placement.
- `src/components/`: shared `SiteHeader`, conventional `PortfolioPage` and room reading dialogs. Reusable shadcn components and button size variants live in `src/components/ui/`.
- `src/styles.css`: Tailwind v4 theme tokens, base defaults and room/dialog styles. Page/navigation layout uses Tailwind utilities in its components. `src/layout.css` contains only bespoke room overlays. Scoped project illustrations live in `ProjectArtwork.module.css`.

Profile roles have separate `title` and `team` fields; `formatRole` supplies the combined label. Project entries can choose `artwork: 'record' | 'books' | 'breeze'`; leaving it out uses a neutral panel. Photo entries include their actual pixel `width` and `height`. Set `featured: true` on the hero photo; without a featured entry the first photo is used. An empty photo array leaves the portfolio readable with an empty gallery message.

Keep `src/main.tsx`'s global CSS imports before component imports: they establish Tailwind's base/component/utility layer order. Put ordinary styling beside its component; use shared tokens and existing variants before adding values. Keep bespoke illustration CSS scoped and in the components layer so utilities can override it.

## Update the room

`src/room/pixi/` owns the renderer independently of the React interface:

- `assets.ts`: the 11 runtime art/photo paths and illustration-space positions.
- `scene.ts`, `runtime.ts`, `layout.ts`: layers, interactions, viewport fitting, loading and cleanup.
- `motion.ts`, `window-wind.ts`: shared time and wind; individual fan, sleeper and ambient modules define each object's response.
- `bird-behavior.ts`: seeded action selection, quiet holds and flight cooldowns. Each visit shuffles six idle actions, excludes the last two choices, and varies their durations. Flights wait 120–210 seconds after landing, then finish the current action/hold. `bird-frames.ts` registers the 16 painted poses and foot pivots; update these together when replacing the dove sheet. There is no fixed repeating timeline or additional animation loop.
- `bird-flight.ts`: three authored garden curves, shuffled without consecutive departure repeats. Returns use a different route after 8–16 seconds away, ease into the same sill perch and retain their landing direction. Edit the curve control points here; keep their full wing bounds inside the garden opening. Flight clipping keeps wing tips behind the sill without cutting off perched feet.
- `camera.ts`, `camera-constants.ts`: drag velocity, elapsed-time glide and spring return. Edge pulls keep a fixed scale and briefly reveal up to 24 CSS pixels of the theme's warm paper backdrop per edge before springing back. The renderer reads `--paper` from the shared CSS theme on mount. Tune motion independently from ambient wind and breathing.
- `discovery.ts`, `surface-registration.ts`: monitor/photo perspective, labels and click areas.
- `lighting.ts`, `lighting-math.ts`, `window-registration.ts`: art-directed window-light projections and surface coverage.

Interaction motion stays in the existing room frame loop. Panning, glide and rebound are horizontal-only and require artwork cropped off the left/right edges, as on phones. Up/down dragging never moves the room, including on wide landscape screens. The cursor, keyboard controls, touch gesture policy and drag hint follow horizontal crop, not a device breakpoint. Re-grabbing, cancellation, navigation, resize and hiding the tab stop stale momentum. Reduced motion retains direct panning without glide or rebound. Shared UI feedback lives in `components/ui/button-ripple.tsx`; button and dialog easing use the `ease-out-quint` Tailwind token. Ripples are decorative, clipped inside controls, and do not delay links or keyboard actions.

`public/art/` contains only current production artwork. The ball, keyboard, guitar and longboard are integrated into the background; moving objects are separate textures. `summer-room-v11.svg` contains the base painting and a small transparent ball repair, decoded once into one texture. When replacing artwork, keep its illustration-space registration and update the corresponding masks and tests. The camera file's historical name, `tripod-reference-v4.webp`, refers to generated production art, not a reference photograph.

Input photos, research, local memory, screenshots, unused art and generation drafts are deliberately excluded from this repository. Personal photographs, logo, résumé and artwork remain Michael's assets; no reuse license is granted by this template structure.

## Publish to GitHub Pages

The site builds into `dist/`, uses relative asset paths and hash navigation, and supports the `/whirlfolio3/` repository path without server routing rules.

1. Push changes to `WhirlyFan/whirlfolio3` using the WhirlyFan account.
2. In repository Settings → Pages, use **GitHub Actions** as the publishing source.
3. Merge changes into `main`. **Deploy portfolio to GitHub Pages** runs automatically on pushes to `main`, including merges. It installs locked dependencies, builds and publishes `dist/` after the build succeeds. Manual runs remain available from the Actions tab.
4. Open the deployment URL reported by the workflow.

Pushes to `dev` do not deploy. GitHub Pages is configured to serve this repository at `https://whirlyfan.com/` with HTTPS enforced. Deployments preserve that repository setting; they do not change DNS. For this Actions-based publishing setup, the custom domain lives in Settings → Pages, not a repository `CNAME` file.

Tests are optional and do not block deployment. Run `pnpm test` for unit tests or `pnpm test:e2e` for browser tests when useful; install the browser with `pnpm exec playwright install chromium` before the first browser-test run.

This is the first iteration. Individual bird actions recur naturally, but their sequence and timing are not a fixed loop.
