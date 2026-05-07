# PWA hosting headers (static hosting/CDN)

These cache rules are important for PWAs so updates are picked up reliably while keeping hashed assets long-lived.

## Recommended Cache-Control rules

- **`/service-worker.js`**
  - `Cache-Control: no-cache, max-age=0, must-revalidate`
- **`/index.html`**
  - `Cache-Control: no-cache, max-age=0, must-revalidate`
- **`/site.webmanifest`**
  - `Cache-Control: no-cache, max-age=0, must-revalidate`
- **Hashed JS/CSS chunks** (e.g. `*.{js,css}` with content hash in filename)
  - `Cache-Control: public, max-age=31536000, immutable`
- **Icons** (e.g. `/android-chrome-192x192.png`, `/apple-touch-icon.png`, `/favicon-*.png`)
  - `Cache-Control: public, max-age=604800` (1 week) or longer if you version filenames

## Notes

- If you set aggressive caching on `service-worker.js` or `index.html`, clients may get “stuck” on old versions.
- With Nx/Webpack production builds, JS/CSS bundles are content-hashed (`outputHashing: all`), so long-lived caching is safe.

