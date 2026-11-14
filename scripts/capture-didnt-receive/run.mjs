/**
 * Screenshots of the "Didn't receive the item?" report.
 * Reuses the accept-and-start esbuild stubs. Not imported by App.tsx,
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
const outDir = '/tmp/capture-didnt-receive';
const mobileOut = '/tmp/capture-didnt-receive/mobile.js';
const artifacts = '/opt/cursor/artifacts/didnt-receive';
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
  entryPoints: ['scripts/capture-didnt-receive/app.tsx'],
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
await buildMobile(mobileOut, 'scripts/capture-didnt-receive/mobile-app.tsx');

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;background:#FAF9F7}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;

function listen(js, port) {
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

const webServer = await listen(readFileSync(path.join(outDir, 'app.js')), 8771);
const mobileServer = await listen(readFileSync(mobileOut), 8772);
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const linkName = {
  en: "Didn't receive the item? Tell us",
  fr: 'Vous n’avez pas reçu l’article ? Prévenez-nous',
};
const confirmName = {
  en: 'Notify support and the business',
  fr: 'Prévenir le support et le commerce',
};
const successName = {
  en: 'Support and the business were notified',
  fr: 'Le support et le commerce ont été prévenus',
};
const errorName = {
  en: 'The 30-minute window to report a missing item has closed.',
  fr: 'Le délai de 30 minutes est passé.',
};
const businessBody = {
  en: "The renter says they haven't received the item. Support will follow up.",
  fr: "Le client indique ne pas avoir reçu l'article. Le support va vous contacter.",
};

const widths = [
  ['en', 390, 'en'],
  ['fr', 390, 'fr'],
  ['en', 360, '360'],
];

async function open(port, query, width) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
  page.on('pageerror', (err) => console.log('PAGEERROR', query, err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('CONSOLE', query, msg.text());
  });
  await page.goto(`http://127.0.0.1:${port}/?${query}`, { waitUntil: 'networkidle' });
  return page;
}

async function shot(page, file, locator) {
  if (locator) await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(artifacts, file) });
  await page.close();
}

for (const [lang, width, label] of widths) {
  const link = await open(8771, `view=renter&lang=${lang}&report=1`, width);
  const linkButton = link.getByRole('button', { name: linkName[lang] });
  await linkButton.waitFor({ timeout: 15000 });
  await shot(link, `web-renter-link-${label}.png`, linkButton);

  const confirm = await open(8771, `view=renter&lang=${lang}&report=1`, width);
  await confirm.getByRole('button', { name: linkName[lang] }).click();
  await confirm.getByText(confirmName[lang]).waitFor();
  await shot(confirm, `web-renter-confirm-${label}.png`);

  const success = await open(8771, `view=renter&lang=${lang}&report=1`, width);
  await success.getByRole('button', { name: linkName[lang] }).click();
  await success.getByRole('button', { name: confirmName[lang] }).click();
  await success.getByText(successName[lang]).waitFor();
  await shot(success, `web-renter-success-${label}.png`);

  const error = await open(8771, `view=renter&lang=${lang}&report=1&reportResult=error`, width);
  await error.getByRole('button', { name: linkName[lang] }).click();
  await error.getByRole('button', { name: confirmName[lang] }).click();
  await error.getByText(errorName[lang]).waitFor();
  await shot(error, `web-renter-error-${label}.png`);

  const mobileLink = await open(8772, `view=renter&lang=${lang}&report=1`, width);
  const mobileLinkButton = mobileLink.getByRole('button', { name: linkName[lang] });
  await mobileLinkButton.waitFor({ timeout: 15000 });
  await shot(mobileLink, `mobile-renter-link-${label}.png`, mobileLinkButton);

  const mobileConfirm = await open(8772, `view=renter&lang=${lang}&report=1`, width);
  await mobileConfirm.getByRole('button', { name: linkName[lang] }).click();
  await mobileConfirm.getByText(confirmName[lang]).waitFor();
  await shot(mobileConfirm, `mobile-renter-confirm-${label}.png`);

  const mobileSuccess = await open(8772, `view=renter&lang=${lang}&report=1`, width);
  await mobileSuccess.getByRole('button', { name: linkName[lang] }).click();
  await mobileSuccess.getByRole('button', { name: confirmName[lang] }).click();
  await mobileSuccess.getByText(successName[lang]).waitFor();
  await shot(mobileSuccess, `mobile-renter-success-${label}.png`);

  const mobileError = await open(8772, `view=renter&lang=${lang}&report=1&reportResult=error`, width);
  await mobileError.getByRole('button', { name: linkName[lang] }).click();
  await mobileError.getByRole('button', { name: confirmName[lang] }).click();
  await mobileError.getByText(errorName[lang]).waitFor();
  await shot(mobileError, `mobile-renter-error-${label}.png`);
}

for (const [lang, width, label] of [
  ['en', 390, 'en'],
  ['fr', 390, 'fr'],
]) {
  const inbox = await open(8772, `view=inbox&lang=${lang}`, width);
  await inbox.getByText(businessBody[lang]).waitFor({ timeout: 15000 });
  await shot(inbox, `business-inbox-${label}.png`);

  const email = await open(8771, `view=notice&kind=business-email&lang=${lang}`, width);
  await email.getByText(businessBody[lang]).waitFor();
  await shot(email, `business-email-${label}.png`);

  const push = await open(8771, `view=notice&kind=business-push&lang=${lang}`, width);
  await push.getByText(businessBody[lang]).waitFor();
  await shot(push, `business-push-${label}.png`);
}

for (const [lang, width, label] of [
  ['en', 1280, 'en'],
  ['fr', 1280, 'fr'],
  ['en', 360, '360'],
]) {
  const admin = await open(8771, `view=admin&lang=${lang}`, width);
  const adminHint = {
    en: "Renters who say the item wasn't handed over after start.",
    fr: "Clients indiquant ne pas avoir reçu l'article après le démarrage.",
  };
  await admin.getByText(adminHint[lang]).waitFor({ timeout: 15000 });
  await admin.getByText('RB-104218').waitFor();
  await shot(admin, `support-admin-${label}.png`);
}

const supportEmail = await open(8771, 'view=notice&kind=support-email&lang=en', 390);
await supportEmail.getByText('No refund or cancellation.').waitFor();
await shot(supportEmail, 'support-email-en.png');

await browser.close();
webServer.close();
mobileServer.close();
console.log('wrote', artifacts);
