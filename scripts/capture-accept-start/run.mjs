/**
 * Screenshots of the accept-and-start flows.
 *
 * Web: the real RentalBookingDetailPage, bundled with esbuild and opened in Chrome.
 * Mobile: the real apps/mobile screens (ClientInspectionScreen, client booking
 * detail, BusinessRentalBookingDetailScreen) rendered with react-native-web.
 * This VM has no Android emulator or iOS simulator.
 *
 * Capture tooling stays in this directory. It is not imported by App.tsx,
 * index.js, or the web entry.
 */
import * as esbuild from 'esbuild';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { buildMobile } from './build-mobile.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const stub = path.join(root, 'scripts/capture-accept-start/stubs.tsx');
const outDir = '/tmp/capture-accept';
const mobileOut = '/tmp/capture-mobile/app.js';
const artifacts = '/opt/cursor/artifacts';
mkdirSync(artifacts, { recursive: true });
mkdirSync('/tmp/capture-mobile', { recursive: true });

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
await buildMobile(mobileOut, undefined, { keepVectorIcons: true });

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;background:#FAF9F7} img{object-fit:cover}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
const heroPng = readFileSync(path.join(root, 'scripts/capture-inspection-optin/hero.png'));

function listen(js, port) {
  const server = createServer((req, res) => {
    const url = req.url?.split('?')[0] ?? '';
    if (url === '/hero-jbl.png' || url === '/hero.png') {
      res.setHeader('content-type', 'image/png');
      res.end(heroPng);
      return;
    }
    if (url === '/app.js') {
      res.setHeader('content-type', 'text/javascript');
      res.end(js);
      return;
    }
    res.setHeader('content-type', 'text/html');
    res.end(html);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

const webServer = await listen(readFileSync(path.join(outDir, 'app.js')), 8765);
const mobileServer = await listen(readFileSync(mobileOut), 8766);

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const copy = {
  web: {
    en: {
      unit: 'Unit 2',
      accept: 'Accept condition & start rental',
      sheet: 'Start this rental?',
      fail: "Payment didn't go through",
      retry: 'Retry',
      waitingPhone: 'Approve on your phone',
      review: 'Review item condition',
      started: 'Canon EOS R50',
      waiting: 'Waiting for the renter to accept',
      handed: 'Started, hand over the item',
      pin: 'Send start PIN',
    },
    fr: {
      unit: 'Unité 2',
      accept: 'Accepter l’état et démarrer la location',
      sheet: 'Démarrer cette location ?',
      fail: "Paiement n'a pas abouti",
      retry: 'Réessayer',
      waitingPhone: 'Approuvez sur votre téléphone',
      review: 'Vérifiez l’état de l’article',
      started: 'Canon EOS R50',
      waiting: 'En attente de l’acceptation du locataire',
      handed: 'Démarrée, remettez l’article',
      pin: 'Envoyer le code PIN',
    },
  },
  mobile: {
    en: {
      unit: 'Unit 2',
      accept: 'Accept condition & start rental',
      sheet: 'Start this rental?',
      fail: 'Payment failed',
      retry: 'Retry',
      waitingPhone: 'Approve on your phone',
      review: 'Review item condition',
      started: 'Canon EOS R50',
      waiting: 'Waiting for the renter to accept',
      handed: 'Started, hand over the item',
      pin: 'Send start PIN',
    },
    fr: {
      unit: 'Unité 2',
      accept: 'Accepter l’état et démarrer la location',
      sheet: 'Démarrer cette location ?',
      fail: 'Paiement échoué',
      retry: 'Réessayer',
      waitingPhone: 'Approuvez sur votre téléphone',
      review: 'Vérifiez l’état de l’article',
      started: 'Canon EOS R50',
      waiting: 'En attente de l’acceptation du locataire',
      handed: 'Démarrée, remettez l’article',
      pin: 'Envoyer le code PIN',
    },
  },
};

const variants = [
  ['en', 390, 'en'],
  ['fr', 390, 'fr'],
  ['en', 360, '360'],
];

function strings(surface, lang) {
  return copy[surface][lang === 'fr' ? 'fr' : 'en'];
}

async function open(surface, scene, lang, width) {
  const port = surface === 'mobile' ? 8766 : 8765;
  const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
  page.on('pageerror', (err) => console.log('PAGEERROR', surface, scene, err.message));
  await page.goto(`http://127.0.0.1:${port}/?scene=${scene}&lang=${lang}`, { waitUntil: 'networkidle' });
  return page;
}

const viewportShot = ['01-review', '02-sheet', 'momo-fail', 'momo-retry'];

async function save(page, file) {
  const fullPage = !viewportShot.some((state) => file.startsWith(state));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(artifacts, file), fullPage });
  await page.close();
}

async function enableAccept(page, text) {
  const unit = page.getByRole('button', { name: text.unit });
  await unit.first().waitFor({ timeout: 15000 });
  if ((await unit.count()) === 0) {
    console.log('MISSING UNIT', (await page.locator('body').innerText()).slice(0, 800));
    return false;
  }
  await unit.first().click();
  await page.waitForFunction((label) => {
    return [...document.querySelectorAll('button')].some((button) => {
      const name = button.textContent ?? '';
      return name.includes(label) && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
    });
  }, text.accept);
  return true;
}

async function openSheet(page, text) {
  const ready = await enableAccept(page, text);
  if (!ready) return false;
  await page.locator('button').filter({ hasText: text.accept }).first().click();
  await page.getByText(text.sheet).first().waitFor();
  return true;
}

const only = process.argv.slice(2);
function selected(file) {
  if (only.length === 0) return true;
  const stem = file.replace(/\.png$/, '');
  return only.includes(stem);
}

for (const surface of ['web', 'mobile']) {
  for (const [lang, width, suffix] of variants) {
    const text = strings(surface, lang);
    const tag = `${surface}-${suffix}`;
    try {
    if (selected(`01-review-${tag}.png`)) {
    const review = await open(surface, 'review', lang, width);
    const ready = await enableAccept(review, text);
    if (!ready) await review.screenshot({ path: path.join(artifacts, `debug-01-review-${tag}.png`), fullPage: true });
    await save(review, `01-review-${tag}.png`);
    }

    if (selected(`02-sheet-${tag}.png`)) {
    const sheet = await open(surface, 'review', lang, width);
    const opened = await openSheet(sheet, text);
    if (!opened) await sheet.screenshot({ path: path.join(artifacts, `debug-02-sheet-${tag}.png`), fullPage: true });
    await save(sheet, `02-sheet-${tag}.png`);
    }

    if (selected(`03-started-${tag}.png`)) {
    const started = await open(surface, 'started', lang, width);
    await started.getByText(text.started).first().waitFor({ timeout: 15000 });
    await save(started, `03-started-${tag}.png`);
    }

    if (selected(`04a-waiting-${tag}.png`)) {
    const waiting = await open(surface, 'waiting', lang, width);
    await waiting.getByText(text.waiting).first().waitFor({ timeout: 15000 });
    await save(waiting, `04a-waiting-${tag}.png`);
    }

    if (selected(`04b-started-${tag}.png`)) {
    const handed = await open(surface, 'handed', lang, width);
    await handed.getByText(text.handed).first().waitFor({ timeout: 15000 });
    await save(handed, `04b-started-${tag}.png`);
    }

    if (selected(`legacy-pin-${tag}.png`)) {
    const legacy = await open(surface, 'legacy', lang, width);
    await legacy.getByText(text.pin).first().waitFor({ timeout: 15000 });
    await save(legacy, `legacy-pin-${tag}.png`);
    }

    if (selected(`momo-fail-${tag}.png`)) {
    const momo = await open(surface, 'momo', lang, width);
    const momoReady = await openSheet(momo, text);
    if (momoReady) {
      const confirms = momo.locator('button').filter({ hasText: text.accept });
      await confirms.last().click();
      await momo.getByText(text.fail).first().waitFor({ timeout: 15000 });
    }
    await save(momo, `momo-fail-${tag}.png`);
    }

    if (selected(`momo-retry-${tag}.png`)) {
    const retry = await open(surface, 'momo', lang, width);
    const retryReady = await openSheet(retry, text);
    if (retryReady) {
      await retry.locator('button').filter({ hasText: text.accept }).last().click();
      await retry.getByText(text.fail).first().waitFor({ timeout: 15000 });
      await retry.getByRole('button', { name: text.retry }).first().click();
      await retry.getByText(text.waitingPhone).first().waitFor({ timeout: 15000 });
    }
    await save(retry, `momo-retry-${tag}.png`);
    }
    console.log('done', tag);
    } catch (error) {
      console.log('FAIL', tag, error instanceof Error ? error.message.split('\n')[0] : error);
    }
  }
}

const shots = [
  ['mobile', 'before', 'en', 390, '01-before-start-day-en.png', 'Pickup'],
  ['mobile', 'before', 'fr', 390, '01-before-start-day-fr.png', 'Retrait'],
  ['mobile', 'today', 'en', 390, '02-start-day-card-en.png', 'Start rental'],
  ['mobile', 'today', 'fr', 390, '02-start-day-card-fr.png', 'Démarrer'],
  ['mobile', 'momoDay', 'en', 390, '02b-start-day-momo-en.png', 'FCFA'],
  ['mobile', 'momoDay', 'fr', 390, '02b-start-day-momo-fr.png', 'FCFA'],
  ['mobile', 'late', 'en', 390, '02c-late-pickup-en.png', 'Late pickup'],
  ['mobile', 'late', 'fr', 390, '02c-late-pickup-fr.png', 'Retrait en retard'],
  ['mobile', 'momoDay', 'en', 390, '02d-momo-waiting-en.png', 'Approve on your phone'],
  ['mobile', 'momoDay', 'fr', 390, '02d-momo-waiting-fr.png', 'Approuvez'],
  ['mobile', 'today', 'en', 390, '03-confirm-sheet-en.png', 'Start rental?'],
  ['mobile', 'today', 'fr', 390, '03-confirm-sheet-fr.png', 'Démarrer la location ?'],
  ['mobile', 'momoDay', 'en', 390, '03b-momo-confirm-en.png', 'Start rental?'],
  ['mobile', 'momoDay', 'fr', 390, '03b-momo-confirm-fr.png', 'Démarrer la location ?'],
  ['mobile', 'startedSimple', 'en', 390, '04-started-en.png', 'In progress'],
  ['mobile', 'startedSimple', 'fr', 390, '04-started-fr.png', 'En cours'],
  ['mobile', 'inspect', 'en', 390, '05-inspect-step1-en.png', 'Matches'],
  ['mobile', 'inspect', 'fr', 390, '05-inspect-step1-fr.png', 'correspond'],
  ['mobile', 'inspect', 'en', 390, '06-ask-photos-sheet-en.png', 'ask for new photos'],
  ['mobile', 'inspect', 'fr', 390, '06-ask-photos-sheet-fr.png', 'nouvelles photos'],
  ['mobile', 'waitingPhotos', 'en', 390, '07-waiting-photos-en.png', 'Waiting for new photos'],
  ['mobile', 'waitingPhotos', 'fr', 390, '07-waiting-photos-fr.png', 'nouvelles photos'],
  ['mobile', 'inspectStart', 'en', 390, '08-inspect-step2-en.png', 'Start rental'],
  ['mobile', 'inspectStart', 'fr', 390, '08-inspect-step2-fr.png', 'Démarrer'],
  ['mobile', 'bizWait', 'en', 390, '09-business-waiting-en.png', 'Waiting for'],
  ['mobile', 'bizWait', 'fr', 390, '09-business-waiting-fr.png', 'En attente'],
  ['mobile', 'bizMomo', 'en', 390, '09b-business-waiting-momo-en.png', 'Mobile Money'],
  ['mobile', 'bizMomo', 'fr', 390, '09b-business-waiting-momo-fr.png', 'Mobile Money'],
  ['mobile', 'bizStarted', 'en', 390, '10-business-started-en.png', 'hand over'],
  ['mobile', 'bizStarted', 'fr', 390, '10-business-started-fr.png', 'remettez'],
  ['mobile', 'bizPush', 'en', 390, '10b-business-inapp-en.png', 'Rental started, hand over the item'],
  ['mobile', 'bizPush', 'fr', 390, '10b-business-inapp-fr.png', 'Location démarrée, remettez'],
  ['mobile', 'bizOsPush', 'en', 390, '10c-business-push-en.png', 'You can hand over the item'],
  ['mobile', 'bizOsPush', 'fr', 390, '10c-business-push-fr.png', 'Vous pouvez remettre'],
  ['mobile', 'bizPhotos', 'en', 390, '11-business-photo-request-en.png', 'Send updated photos'],
  ['mobile', 'bizPhotos', 'fr', 390, '11-business-photo-request-fr.png', 'photos'],
  ['web', 'today', 'en', 800, '12-web-renter-start-day-en.png', 'Pickup today'],
  ['web', 'today', 'fr', 800, '12-web-renter-start-day-fr.png', "Retrait aujourd'hui"],
  ['web', 'bizPhotos', 'en', 800, '13-web-business-photo-request-en.png', 'Send updated photos'],
  ['web', 'bizPhotos', 'fr', 800, '13-web-business-photo-request-fr.png', 'photos'],
];

for (const [surface, scene, lang, width, file, text] of shots) {
  if (!selected(file)) continue;
    const sheet = file.startsWith('06-') || file.startsWith('03');
  const height = surface === 'web' ? 900 : 844;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  page.on('pageerror', (err) => console.log('PAGEERROR', file, err.message));
  try {
    const port = surface === 'mobile' ? 8766 : 8765;
    await page.goto(`http://127.0.0.1:${port}/?scene=${scene}&lang=${lang}`, { waitUntil: 'networkidle' });
    let askTitle;
    if (file.startsWith('03')) {
      await page.locator('button').filter({ hasText: /Start rental|Démarrer/ }).first().click();
      askTitle = page.getByText(/^(Start rental\?|Démarrer la location \?)$/).first();
      await askTitle.waitFor({ timeout: 15000 });
    }
    if (file.startsWith('06-')) {
      await page.locator('button').filter({ hasText: /ask for new photos|nouvelles photos/i }).first().click();
      askTitle = page.getByText(/^(Ask for new photos|Demander de nouvelles photos)$/).first();
      const title = askTitle;
      await title.waitFor({ timeout: 15000 });
    }
    if (file.startsWith('02d-')) {
      await page.locator('button').filter({ hasText: /Start rental|Démarrer la location/ }).first().click();
      await page.getByText(/Start rental\?|Démarrer la location \?/).first().waitFor({ timeout: 15000 });
      await page.locator('button').filter({ hasText: /Start rental|Démarrer la location/ }).last().click();
    }
    await page.getByText(text, { exact: false }).first().waitFor({ timeout: 15000 }).catch(() => undefined);
    await page.waitForFunction(() => document.fonts && document.fonts.check('18px "material-community"'), undefined, { timeout: 8000 }).catch(() => undefined);
    await page.waitForFunction(() => {
      const images = [...document.querySelectorAll('img')];
      return images.every((img) => img.complete && img.naturalWidth > 0);
    }, undefined, { timeout: 8000 }).catch(() => undefined);
    if (sheet) {
      await askTitle.locator('xpath=..').screenshot({ path: path.join(artifacts, file) });
    } else {
      const webFull = file.startsWith('12-') || file.startsWith('13-');
      await page.screenshot({ path: path.join(artifacts, file), fullPage: surface === 'mobile' || webFull });
    }
    console.log('shot', file);
  } catch (error) {
    console.log('FAIL', file, error instanceof Error ? error.message.split('\n')[0] : error);
    await page.screenshot({ path: path.join(artifacts, `debug-${file}`), fullPage: true }).catch(() => undefined);
  }
  await page.close();
}

await browser.close();
webServer.close();
mobileServer.close();
console.log('captures written');
