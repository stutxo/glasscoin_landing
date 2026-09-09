# Glasscoins deployment

The primary public site is https://glasscoins-protocol.pages.dev/.

Deploy updates to the existing Cloudflare Pages project:

```sh
npm run deploy:pages
```

This builds a static export in `dist/client` and uploads it to the
`glasscoins-protocol` project, production branch `main`. Wrangler uses the
connected Cloudflare account; no credentials belong in source files.

`npm run build` (also available as `npm run build:pages`) builds the export
without publishing. It includes the interactive coin, shaders, fonts, and image
and requires no server runtime. `npm start` serves that built export locally
using Wrangler's Pages preview.

When upgrading an older checkout, remove any generated
`.wrangler/deploy/config.json` left by an earlier Worker build before previewing
or deploying. Fresh clones do not need this step.
