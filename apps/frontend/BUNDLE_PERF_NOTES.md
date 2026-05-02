# Frontend bundle performance (verify notes)

Run after changes:

```bash
nx build frontend --configuration=production
```

**Latest local verify** (post webpack + lazy-load work):

- Build: `nx run frontend:build:production` — success.
- **Precompressed assets**: `.gz` and `.br` siblings emitted for JS/CSS (see `dist/apps/frontend/*.gz` / `*.br`).
- **Locales**: `public/locales/{en,fr}.json` copied to `dist/apps/frontend/locales/` (not in main JS).
- **Entry**: `main.*.js` + `runtime.*.js` + hashed async chunks (numeric chunk names from webpack); `country-state-city`, charts, calendar, PDF, WhatsApp load on demand via dynamic `import()`.

**Suggested CDN / hosting**

- Serve `*.br` with `Content-Encoding: br` when the client sends `Accept-Encoding: br`; fall back to `*.gz` / identity.
- Long cache: `Cache-Control: public, max-age=31536000, immutable` for hashed assets.

**Optional**

- `npm run analyze:frontend` — writes `dist/apps/frontend/report.html` when `ANALYZE=true` (webpack-bundle-analyzer).
- Lighthouse: Slow 4G mobile on `/`, `/items`, `/items/:id` for before/after comparison.
