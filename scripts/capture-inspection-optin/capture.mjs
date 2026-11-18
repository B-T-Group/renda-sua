/**
 * Screenshots of the real inspection opt-in UI.
 * Web bundles BusinessRentalItemEditPage and RentalInspectionPanel.
 * Mobile bundles the real screens with react-native-web.
 * Nothing here is imported by the app entry points.
 *
 * Usage: node scripts/capture-inspection-optin/capture.mjs
 */
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { buildMobile, buildWeb } from './build.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const here = import.meta.dirname;
const outDir = process.env.OUT_DIR ?? '/opt/cursor/artifacts/inspection-optin/v3';
const webJs = '/tmp/capture-inspection-optin/web.js';
const mobileJs = '/tmp/capture-inspection-optin/mobile.js';
const hero = readFileSync(path.join(here, 'hero.png'));
const iconFont = readFileSync(path.join(
  here,
  '../../apps/mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf',
));
const en = JSON.parse(readFileSync(path.join(here, '../../apps/frontend/public/locales/en.json'), 'utf8')).rentalInspection;
const fr = JSON.parse(readFileSync(path.join(here, '../../apps/frontend/public/locales/fr.json'), 'utf8')).rentalInspection;

mkdirSync(outDir, { recursive: true });
mkdirSync('/tmp/capture-inspection-optin', { recursive: true });
await buildWeb(webJs);
await buildMobile(mobileJs);

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:'material-community';src:url('/fonts/MaterialCommunityIcons.ttf') format('truetype');font-weight:normal;font-style:normal;font-display:block}html,body,#root{margin:0;background:#FAF9F7}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;

function listen(js, port) {
  const server = createServer((req, res) => {
    const url = req.url?.split('?')[0] ?? '/';
    if (url === '/hero.png') {
      res.setHeader('content-type', 'image/png');
      res.end(hero);
      return;
    }
    if (url === '/fonts/MaterialCommunityIcons.ttf') {
      res.setHeader('content-type', 'font/ttf');
      res.setHeader('cache-control', 'public, max-age=86400');
      res.end(iconFont);
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

const webServer = await listen(readFileSync(webJs), 8765);
const mobileServer = await listen(readFileSync(mobileJs), 8766);
const copy = {
  en: strings(en),
  fr: strings(fr),
};

const SHOTS = [
  ['01', 'edit', 'edit'],
  ['02', 'explainer', 'explainer'],
  ['02b', 'explainer-momo', 'explainer-momo'],
  ['03', 'baseline', 'baseline'],
  ['04', 'pickup', 'pickup-reuse'],
  ['04-damage', 'damage', 'pickup-reuse'],
  ['05', 'review', 'renter-review'],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  for (const lang of ['en', 'fr']) {
    for (const [prefix, scene, slug] of SHOTS) {
      await shoot({ browser, lang, scene, file: `${prefix}-web-${slug}-${lang}.png`, port: 8765, width: 1440, height: 900 });
      await shoot({
        browser,
        lang,
        scene,
        file: mobileFile(prefix, slug, lang),
        port: 8766,
        width: 390,
        height: scene === 'explainer' || scene === 'explainer-momo' || scene === 'baseline' ? 1500 : 900,
      });
    }
  }
} finally {
  await browser.close();
  webServer.close();
  mobileServer.close();
}

function strings(pack) {
  return {
    off: pack.optInOff,
    turnOn: pack.optInTurnOn,
    card: pack.optInPayCard.includes('par exemple') ? '65,00' : '$65.00',
    momo: 'FCFA',
    baseline: pack.baselineMore.replace('{{count}}', '2'),
    baselineTitle: pack.baselineTitle,
    reuse: pack.reuseAction,
    damage: pack.reuseBlocked,
    note: pack.reuseTransparency.slice(0, 24),
  };
}

function mobileFile(prefix, slug, lang) {
  if (prefix === '02b') return `02b-explainer-momo-${lang}.png`;
  if (prefix === '04-damage') return `04-damage-pickup-reuse-${lang}.png`;
  return `${prefix}-${slug}-${lang}.png`;
}

async function shoot({ browser, lang, scene, file, port, width, height }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/?scene=${scene}&lang=${lang}`, { waitUntil: 'networkidle' });
  await prepare(page, scene, copy[lang]);
  await page.evaluate(async () => {
    await document.fonts.load("20px 'material-community'");
    await document.fonts.ready;
  });
  const png = await page.screenshot({ type: 'png' });
  await writeCompressed(path.join(outDir, file), png);
  if (errors.length) console.log(`errors ${file}: ${errors.slice(0, 2).join(' | ')}`);
  await page.close();
}

async function prepare(page, scene, text) {
  if (scene === 'edit' || scene === 'explainer' || scene === 'explainer-momo' || scene === 'baseline') {
    await page.getByText(text.off).first().waitFor({ timeout: 15000 });
    if (scene === 'edit') {
      await page.getByText(text.off).first().scrollIntoViewIfNeeded();
      return;
    }
    if (scene === 'baseline') {
      await openBaseline(page, text.turnOn);
      await page.getByText(text.baseline).first().waitFor({ timeout: 10000 });
      await waitForDialog(page);
      await align(page.getByText(text.baselineTitle).first(), 'start');
      return;
    }
    await page.getByLabel('Info').click();
    const marker = scene === 'explainer-momo' ? text.momo : text.card;
    await page.getByText(marker).first().waitFor({ timeout: 10000 });
    await waitForDialog(page);
    await align(page.getByRole('button', { name: text.turnOn }).first(), 'end');
    return;
  }
  const marker = page.getByText(scene === 'damage' ? text.damage : scene === 'review' ? text.note : text.reuse).first();
  await marker.waitFor({ timeout: 15000 });
  await align(marker, 'center');
}

async function openBaseline(page, turnOn) {
  const row = page.getByLabel('Info').locator('..');
  const input = row.locator('input');
  if (await input.count()) await input.first().click();
  else await row.getByRole('switch').click();
  await page.getByRole('button', { name: turnOn }).click();
}

async function waitForDialog(page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('.MuiDialog-container');
    if (!el) return true;
    return Number.parseFloat(getComputedStyle(el).opacity) > 0.95;
  });
}

async function align(locator, block) {
  await locator.evaluate((node, value) => node.scrollIntoView({ block: value, inline: 'nearest' }), block);
}

async function writeCompressed(file, png) {
  let width = null;
  let buf = png;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let pipeline = sharp(png);
    if (width) pipeline = pipeline.resize({ width, withoutEnlargement: true });
    buf = await pipeline.png({ compressionLevel: 9, palette: attempt > 0, quality: 80 }).toBuffer();
    if (buf.length <= 300 * 1024) break;
    width = width ? Math.floor(width * 0.85) : 1200;
  }
  const { writeFile } = await import('node:fs/promises');
  await writeFile(file, buf);
  console.log(`${path.basename(file)} ${buf.length}`);
}
