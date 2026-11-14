/**
 * Screenshots of inspected-rental confirmations with the flag on.
 * Reuses the accept-and-start capture bundles. Not imported by App.tsx,
 * index.js, or the web entry.
 */
import * as esbuild from 'esbuild';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { buildMobile } from '../capture-accept-start/build-mobile.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const stub = path.join(root, 'scripts/capture-accept-start/stubs.tsx');
const hero = '/cursor/stores/bot/handoffs/inspection-confirmations/hero-jbl.png';
const outDir = '/tmp/capture-confirmations';
const artifacts = '/opt/cursor/artifacts/inspection-confirmations';
mkdirSync(outDir, { recursive: true });
mkdirSync(artifacts, { recursive: true });

const aliases = [
  'SessionAuthContext',
  'UserProfileContext',
  'useIsStripeRail',
  'useRentalApi',
  'useClientFlags',
  'useRentalInspection',
  'useTrackSiteEvent',
  'UserMessagesComponent',
];

function isStubbedImport(importPath) {
  const base = importPath.split('/').pop() ?? '';
  const stem = base.replace(/\.(tsx|ts|jsx|js)$/, '');
  return aliases.includes(stem);
}

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ['scripts/capture-accept-start/app.tsx'],
  bundle: true,
  outfile: path.join(outDir, 'web.js'),
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  banner: { js: 'var process = { env: { NODE_ENV: "development" } };' },
  nodePaths: ['apps/frontend/node_modules', 'node_modules'],
  define: { 'process.env.NODE_ENV': '"development"' },
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.jpg': 'dataurl' },
  plugins: [
    {
      name: 'capture-stubs',
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => {
          if (isStubbedImport(args.path)) return { path: stub };
          if (args.path.endsWith('.css')) return { path: args.path, namespace: 'empty' };
          return null;
        });
        build.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' }));
      },
    },
  ],
});
await buildMobile(path.join(outDir, 'mobile.js'));

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;background:#FAF9F7}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
const heroBytes = readFileSync(hero);

function listen(js, port) {
  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url.startsWith('/hero-jbl.png')) {
      res.setHeader('content-type', 'image/png');
      res.end(heroBytes);
      return;
    }
    if (url.startsWith('/app.js')) {
      res.setHeader('content-type', 'text/javascript');
      res.end(js);
      return;
    }
    res.setHeader('content-type', 'text/html');
    res.end(html);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

const webServer = await listen(readFileSync(path.join(outDir, 'web.js')), 8771);
const mobileServer = await listen(readFileSync(path.join(outDir, 'mobile.js')), 8772);
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const shots = [
  { file: '01-client-detail', scene: 'clientReview', en: 'Report ready to review', fr: 'État des lieux à vérifier', pill: 'client-pill' },
  { file: '02-report-sent', scene: 'reportSent', en: 'Condition report sent', fr: 'État des lieux envoyé' },
  { file: '03-business-waiting', scene: 'businessWait', en: 'Waiting for renter', fr: 'En attente du client', pill: 'business-pill' },
  { file: '04-rental-started', scene: 'rentalStarted', en: 'Rental started', fr: 'Location démarrée' },
  { file: '05-momo-started', scene: 'momoStarted', en: 'Payment confirmed', fr: 'Paiement confirmé' },
  { file: '06-rental-started-notice', scene: 'push', en: 'accepted the condition report', fr: 'a accepté l\'état des lieux' },
];

const surfaces = [
  { name: 'mobile', port: 8772, width: 390 },
  { name: 'web', port: 8771, width: 1280 },
];

try {
  for (const surface of surfaces) {
    for (const lang of ['en', 'fr']) {
      for (const shot of shots) {
        const page = await browser.newPage({
          viewport: { width: surface.width, height: surface.name === 'mobile' ? 844 : 900 },
          deviceScaleFactor: 2,
        });
        page.on('pageerror', (err) => console.log('PAGEERROR', surface.name, shot.scene, lang, err.message));
        await page.goto(`http://127.0.0.1:${surface.port}/?scene=${shot.scene}&lang=${lang}`, { waitUntil: 'networkidle' });
        const expected = lang === 'fr' ? shot.fr : shot.en;
        try {
          await page.getByText(expected).first().waitFor({ timeout: 20000 });
        } catch (error) {
          console.log('MISSING', surface.name, shot.file, lang, (await page.locator('body').innerText()).slice(0, 1200));
          throw error;
        }
        const file = `${shot.file}-${surface.name}-${lang}.png`;
        await page.screenshot({ path: path.join(artifacts, file), fullPage: true });
        if (shot.pill) {
          await page.getByText(expected).first().screenshot({
            path: path.join(artifacts, `${shot.pill}-${surface.name}-${lang}.png`),
          });
        }
        await page.close();
        console.log('saved', file);
      }
    }
  }
} finally {
  await browser.close();
  webServer.close();
  mobileServer.close();
}
