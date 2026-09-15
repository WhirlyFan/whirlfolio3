# Whirlfolio3

Michael Lee's interactive summer room and portfolio, built with React, Vite, Tailwind CSS, shadcn/ui and PixiJS. The painted room and the readable portfolio share one content source. This is a new application, not a fork of the previous portfolio.

## Run locally

Use Node 24 and pnpm 11.20.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by Vite. Drag or swipe to explore the room, or focus the canvas and use arrow keys. Click the monitor for projects, the bird frames for photography, or the fan to change its speed. Both views share the same navigation: sections at the top on desktop and at the bottom on smaller screens. The Portfolio tab opens the readable page without loading the room engine and restores your reading position when you return.

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
- `discovery.ts`, `surface-registration.ts`: monitor/photo perspective, labels and click areas.
- `lighting.ts`, `lighting-math.ts`, `window-registration.ts`: art-directed window-light projections and surface coverage.

`public/art/` contains only current production artwork. The ball, keyboard, guitar and longboard are integrated into the background; moving objects are separate textures. `summer-room-v11.svg` contains the base painting and a small transparent ball repair, decoded once into one texture. When replacing artwork, keep its illustration-space registration and update the corresponding masks and tests. The camera file's historical name, `tripod-reference-v4.webp`, refers to generated production art, not a reference photograph.

Input photos, research, local memory, screenshots, unused art and generation drafts are deliberately excluded from this repository. Personal photographs, logo, résumé and artwork remain Michael's assets; no reuse license is granted by this template structure.

## Publish to GitHub Pages

The site builds into `dist/`, uses relative asset paths and hash navigation, and supports the `/whirlfolio3/` repository path without server routing rules.

1. Push verified changes to `WhirlyFan/whirlfolio3` using the WhirlyFan account.
2. In repository Settings → Pages, use **GitHub Actions** as the publishing source.
3. Run **Deploy portfolio to GitHub Pages** from the Actions tab. The manual workflow installs locked dependencies, runs unit/browser tests, builds and publishes `dist/`.
4. Open the deployment URL reported by the workflow.

Deployments are manual, not triggered by every push. No custom domain or `CNAME` is configured here; the existing `whirlyfan.com` site stays unchanged.

This is the first iteration. Less repetitive bird behavior remains follow-up work.
