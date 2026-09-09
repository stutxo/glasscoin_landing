# Glasscoin Landing

The Glasscoins Protocol landing page: an interactive glass Bitcoin on a black
background, with pointer-driven liquid refraction, encrypted text, drag-to-spin
motion, and subtle reflections around the rim.

[Live site](https://glasscoins-protocol.pages.dev/)

## Run locally

Requires Node.js 22.13 or later and npm.

```sh
git clone https://github.com/stutxo/glasscoin_landing.git
cd glasscoin_landing
npm ci
npm run dev
```

Open the local URL printed by the dev server. The landing page does not need
application secrets or a database.

## Build and deploy

```sh
npm run build:pages
```

The static site is generated in `dist/client`. `npm run build` creates the same
export, and `npm start` previews the built site locally.

To publish to the existing Cloudflare Pages project, authenticate Wrangler with
a Cloudflare account that has access to `glasscoins-protocol`, then run:

```sh
npx wrangler login
npm run deploy:pages
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for details. Publishing is a separate step
from pushing code to this repository.

## Code and checks

- `app/page.tsx`: pointer, touch, and keyboard interaction.
- `app/globals.css`: layout and visual fallbacks.
- `lib/glass-renderer.ts`: WebGL coin geometry, refraction, and reflections.
- `lib/coin-motion.ts`: rotation and release momentum.
- `public/images/glass-bitcoin.png`: glass coin artwork.

```sh
npx tsc --noEmit --incremental false
node --experimental-strip-types tests/coin-motion.test.mjs
```
