/**
 * Screenshots of the renter return report. Not imported by App.tsx,
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
const outDir = '/tmp/capture-return-due';
const artifacts = '/opt/cursor/artifacts/return-due';
mkdirSync(artifacts, { recursive: true });
mkdirSync(outDir, { recursive: true });

const aliases = [
  'SessionAuthContext',
  'UserProfileContext',
  'useIsStripeRail',
  'useRentalApi',
  'useClientFlags',
  'useRentalInspection',
  'useTrackSiteEvent',
  'UserMessagesComponent',
  'useApiClient',
  'usePermissions',
];

function isStubbedImport(importPath) {
  const base = importPath.split('/').pop() ?? '';
  const stem = base.replace(/\.(tsx|ts|jsx|js)$/, '');
  return aliases.includes(stem);
}

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ['scripts/capture-return-due/app.tsx'],
  bundle: true,
  outfile: path.join(outDir, 'app.js'),
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
await buildMobile(path.join(outDir, 'mobile.js'), 'scripts/capture-return-due/mobile-app.tsx');

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;background:#FAF9F7}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;

function listen(file, port) {
  const js = readFileSync(file);
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/app.js')) {
      res.setHeader('content-type', 'text/javascript');
      res.end(js);
      return;
    }
    res.setHeader('content-type', 'text/html');
    res.end(html);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

const webServer = await listen(path.join(outDir, 'app.js'), 8781);
const mobileServer = await listen(path.join(outDir, 'mobile.js'), 8782);
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const DUE = '2026-11-12T18:00:00.000Z';
const OVERDUE = '2026-11-12T20:00:00.000Z';
const WAITING = '2026-11-12T19:30:00.000Z';
const ESCALATED = '2026-11-13T18:42:00.000Z';

async function shot(port, query, file, width, height, click) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  page.on('pageerror', (err) => console.log('PAGEERROR', query, err.stack || err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('CONSOLE', query, msg.text().slice(0, 400));
  });
  await page.goto(`http://127.0.0.1:${port}/?${query}`);
  await page.waitForTimeout(600);
  if (click) {
    const button = page.getByRole('button', { name: click }).first();
    if (await button.count()) await button.click();
    else console.log('NOCLICK', query, click);
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: path.join(artifacts, file), fullPage: port !== 8782 });
  await page.close();
  console.log(file);
}

const mobile = [
  ['return=due&now=' + DUE + '&lang=en', 'mobile-return-due-en.png', 390, "I've returned it"],
  ['return=due&now=' + DUE + '&lang=fr', 'mobile-return-due-fr.png', 390],
  ['return=due&now=' + DUE + '&lang=en', 'mobile-return-due-360.png', 360],
  ['return=due&now=' + DUE + '&lang=en&view=renter', 'mobile-confirm-sheet-en.png', 390, /returned it/i],
  ['return=due&now=' + DUE + '&lang=fr&view=renter', 'mobile-confirm-sheet-fr.png', 390, /rendu/i],
  ['return=due&now=' + DUE + '&lang=en&view=renter', 'mobile-confirm-sheet-360.png', 360, /returned it/i],
  ['return=waiting&now=' + WAITING + '&lang=en', 'mobile-waiting-en.png', 390],
  ['return=waiting&now=' + WAITING + '&lang=fr', 'mobile-waiting-fr.png', 390],
  ['return=waiting&now=' + WAITING + '&lang=en', 'mobile-waiting-360.png', 360],
  ['return=overdue&now=' + OVERDUE + '&lang=en', 'mobile-overdue-en.png', 390],
  ['return=overdue&now=' + OVERDUE + '&lang=fr', 'mobile-overdue-fr.png', 390],
  ['return=overdue&now=' + OVERDUE + '&lang=en', 'mobile-overdue-360.png', 360],
  ['return=escalated&now=' + ESCALATED + '&lang=en', 'mobile-escalated-en.png', 390],
  ['return=escalated&now=' + ESCALATED + '&lang=fr', 'mobile-escalated-fr.png', 390],
  ['return=escalated&now=' + ESCALATED + '&lang=en', 'mobile-escalated-360.png', 360],
  ['return=business&now=' + WAITING + '&lang=en&view=business', 'mobile-business-en.png', 390],
  ['return=business&now=' + WAITING + '&lang=fr&view=business', 'mobile-business-fr.png', 390],
  ['return=list&now=' + OVERDUE + '&lang=en&view=list&segment=action_needed', 'mobile-my-rentals-chips-en.png', 390],
  ['return=due&now=' + DUE + '&lang=en&view=badge-before', 'mobile-badge-before-en.png', 390],
  ['return=due&now=' + DUE + '&lang=en&view=badge-after', 'mobile-badge-after-en.png', 390],
];

for (const [query, file, width, click] of mobile) {
  const openSheet = file.includes('confirm-sheet');
  await shot(8782, query, file, width, 844, openSheet ? click : undefined);
}

await shot(8781, `return=due&now=${DUE}&lang=en&view=renter`, 'web-return-due-en.png', 1280, 900);
await shot(8781, `return=due&now=${DUE}&lang=fr&view=renter`, 'web-return-due-fr.png', 1280, 900);
await shot(8781, `return=business&now=${WAITING}&lang=en&view=business`, 'web-business-en.png', 1280, 900);
await shot(8781, `return=business&now=${WAITING}&lang=fr&view=business`, 'web-business-fr.png', 1280, 900);
await shot(8781, `return=list&now=${OVERDUE}&lang=en&view=list`, 'web-my-rentals-chips-en.png', 480, 900);
await shot(8781, 'return=admin&lang=en&view=admin', 'web-admin-list-en.png', 1100, 900);
await shot(8781, 'return=admin&lang=en&view=admin', 'web-admin-confirm-en.png', 1100, 900, 'Confirm return');

await browser.close();
webServer.close();
mobileServer.close();
console.log('done', artifacts);
