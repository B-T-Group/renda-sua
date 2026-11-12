/**
 * Second-pass screenshots for the "Didn't receive the item?" review.
 * Reuses the accept-and-start esbuild stubs. Not imported by App.tsx,
 * index.js, or the web entry.
 */
import * as esbuild from 'esbuild';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { buildMobile } from '../capture-accept-start/build-mobile.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const stub = path.join(root, 'scripts/capture-accept-start/stubs.tsx');
const outDir = '/tmp/capture-didnt-receive-v2';
const mobileOut = '/tmp/capture-didnt-receive-v2/mobile.js';
const artifacts = '/opt/cursor/artifacts/didnt-receive-v2';
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

const webServer = await listen(readFileSync(path.join(outDir, 'app.js')), 8773);
const mobileServer = await listen(readFileSync(mobileOut), 8774);
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const copy = {
  en: {
    link: "Didn't receive the item? Tell us",
    confirm: 'Notify support and the business',
    window: 'The 30-minute window to report a missing item has closed.',
    network: "Check your connection and try again.",
    retry: 'Try again',
    contact: 'Contact support',
    reported: 'Reported · support will follow up',
    admin: "Renters who say the item wasn't handed over after start.",
    status: 'In progress',
  },
  fr: {
    link: 'Vous n’avez pas reçu l’article ? Prévenez-nous',
    confirm: 'Prévenir le support et le commerce',
    window: 'Le délai de 30 minutes est passé.',
    network: "Vérifiez votre connexion et réessayez.",
    retry: 'Réessayer',
    contact: 'Contacter le support',
    reported: 'Signalé · le support va vous contacter',
    admin: "Clients indiquant ne pas avoir reçu l'article après le démarrage.",
    status: 'En cours',
  },
};

const widths = [
  ['en', 390, 'en'],
  ['fr', 390, 'fr'],
  ['en', 360, '360'],
];
const notes = [];

async function open(port, query, width) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
  page.on('pageerror', (err) => console.log('PAGEERROR', query, err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('CONSOLE', query, msg.text());
  });
  await page.goto(`http://127.0.0.1:${port}/?${query}`, { waitUntil: 'networkidle' });
  return page;
}

async function shot(page, file) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(artifacts, file) });
  await page.close();
}

async function buttonColor(page, name) {
  const button = page.getByRole('button', { name });
  return button.evaluate((el) => {
    const seen = [];
    const consider = (node) => {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') seen.push(bg);
    };
    const walk = (node) => {
      consider(node);
      for (const child of node.children) walk(child);
    };
    walk(el);
    let node = el.parentElement;
    for (let i = 0; i < 8 && node; i += 1) {
      consider(node);
      node = node.parentElement;
    }
    return seen.find((color) => color === 'rgb(10, 79, 181)') ?? seen[0] ?? 'none';
  });
}

for (const [lang, width, label] of widths) {
  const text = copy[lang];

  const closed = await open(8773, `view=renter&lang=${lang}&report=1&reportResult=window`, width);
  await closed.getByRole('button', { name: text.link }).click();
  await closed.getByRole('button', { name: text.confirm }).click();
  await closed.getByText(text.window).waitFor();
  await closed.getByRole('button', { name: 'OK' }).waitFor();
  await closed.getByRole('button', { name: text.contact }).waitFor();
  if ((await closed.getByRole('button', { name: text.retry }).count()) !== 0) {
    throw new Error(`web window-closed still offers retry (${label})`);
  }
  await shot(closed, `web-window-closed-${label}.png`);

  const network = await open(8773, `view=renter&lang=${lang}&report=1&reportResult=network`, width);
  await network.getByRole('button', { name: text.link }).click();
  await network.getByRole('button', { name: text.confirm }).click();
  await network.getByText(text.network).waitFor();
  await network.getByRole('button', { name: text.retry }).waitFor();
  await shot(network, `web-network-${label}.png`);

  const hidden = await open(8773, `view=renter&lang=${lang}&report=1&window=closed`, width);
  await hidden.getByRole('heading', { name: 'Canon EOS R50' }).first().waitFor({ timeout: 15000 });
  if ((await hidden.getByRole('button', { name: text.link }).count()) !== 0) {
    throw new Error(`web link still visible after the window (${label})`);
  }
  if ((await hidden.getByText(text.reported).count()) !== 0) {
    throw new Error(`web reported line shown when the window closed (${label})`);
  }
  await shot(hidden, `web-link-hidden-${label}.png`);

  const reported = await open(8773, `view=renter&lang=${lang}&report=1&reported=1`, width);
  await reported.getByText(text.reported).waitFor({ timeout: 15000 });
  if ((await reported.getByRole('button', { name: text.link }).count()) !== 0) {
    throw new Error(`web link still visible after a report (${label})`);
  }
  await shot(reported, `web-reported-${label}.png`);

  const confirm = await open(8773, `view=renter&lang=${lang}&report=1`, width);
  await confirm.getByRole('button', { name: text.link }).click();
  await confirm.getByRole('button', { name: text.confirm }).waitFor();
  const webColor = await buttonColor(confirm, text.confirm);
  notes.push(`web confirm ${label} ${webColor}`);
  if (webColor !== 'rgb(10, 79, 181)') throw new Error(`web confirm color ${webColor}`);
  await shot(confirm, `web-confirm-${label}.png`);

  const mobileClosed = await open(8774, `view=renter&lang=${lang}&report=1&reportResult=window`, width);
  await mobileClosed.getByRole('button', { name: text.link }).click();
  await mobileClosed.getByRole('button', { name: text.confirm }).click();
  await mobileClosed.getByText(text.window).waitFor();
  await mobileClosed.getByRole('button', { name: 'OK' }).waitFor();
  await mobileClosed.getByRole('button', { name: text.contact }).waitFor();
  if ((await mobileClosed.getByRole('button', { name: text.retry }).count()) !== 0) {
    throw new Error(`mobile window-closed still offers retry (${label})`);
  }
  await shot(mobileClosed, `mobile-window-closed-${label}.png`);

  const mobileNetwork = await open(8774, `view=renter&lang=${lang}&report=1&reportResult=network`, width);
  await mobileNetwork.getByRole('button', { name: text.link }).click();
  await mobileNetwork.getByRole('button', { name: text.confirm }).click();
  await mobileNetwork.getByText(text.network).waitFor();
  await mobileNetwork.getByRole('button', { name: text.retry }).waitFor();
  await shot(mobileNetwork, `mobile-network-${label}.png`);

  const mobileHidden = await open(8774, `view=renter&lang=${lang}&report=1&window=closed`, width);
  await mobileHidden.getByText('Canon EOS R50').first().waitFor({ timeout: 15000 });
  if ((await mobileHidden.getByRole('button', { name: text.link }).count()) !== 0) {
    throw new Error(`mobile link still visible after the window (${label})`);
  }
  await shot(mobileHidden, `mobile-link-hidden-${label}.png`);

  const mobileReported = await open(8774, `view=renter&lang=${lang}&report=1&reported=1`, width);
  await mobileReported.getByText(text.reported).waitFor({ timeout: 15000 });
  if ((await mobileReported.getByRole('button', { name: text.link }).count()) !== 0) {
    throw new Error(`mobile link still visible after a report (${label})`);
  }
  await shot(mobileReported, `mobile-reported-${label}.png`);

  const mobileConfirm = await open(8774, `view=renter&lang=${lang}&report=1`, width);
  await mobileConfirm.getByRole('button', { name: text.link }).click();
  await mobileConfirm.getByRole('button', { name: text.confirm }).waitFor();
  const mobileColor = await buttonColor(mobileConfirm, text.confirm);
  notes.push(`mobile confirm ${label} ${mobileColor}`);
  if (mobileColor !== 'rgb(10, 79, 181)') throw new Error(`mobile confirm color ${mobileColor}`);
  await shot(mobileConfirm, `mobile-confirm-${label}.png`);
}

for (const [lang, width, label] of [
  ['en', 1280, 'en'],
  ['fr', 1280, 'fr'],
  ['en', 360, '360'],
]) {
  const text = copy[lang];
  const admin = await open(8773, `view=admin&lang=${lang}`, width);
  await admin.getByText(text.admin).waitFor({ timeout: 15000 });
  await admin.getByText('RB-104218').waitFor();
  await admin.getByText(text.status).waitFor();
  const reportedAt = admin.getByText('14:22');
  await reportedAt.waitFor();
  await reportedAt.scrollIntoViewIfNeeded();
  await shot(admin, `support-admin-${label}.png`);
}

writeFileSync(path.join(artifacts, 'button-colors.txt'), `${notes.join('\n')}\n`);
await browser.close();
webServer.close();
mobileServer.close();
console.log('wrote', artifacts);
console.log(notes.join('\n'));
