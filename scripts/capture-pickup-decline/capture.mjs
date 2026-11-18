/**
 * Screenshots of the real pickup-decline components.
 * Web: DeclinePickupScreens. Mobile: the react-native screens via react-native-web.
 * Nothing here is imported by the app entry points.
 *
 * Usage: node scripts/capture-pickup-decline/capture.mjs
 */
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { buildMobile, buildWeb } from './build.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = path.resolve(import.meta.dirname, '../..');
const outDir = process.env.OUT_DIR ?? '/opt/cursor/artifacts/pickup-decline/v1';
const webJs = '/tmp/capture-pickup-decline/web.js';
const mobileJs = '/tmp/capture-pickup-decline/mobile.js';
const hero = readFileSync(path.join(root, 'scripts/capture-inspection-optin/hero.png'));
const font = readFileSync(
  path.join(
    root,
    'apps/mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'
  )
);

mkdirSync(outDir, { recursive: true });
mkdirSync('/tmp/capture-pickup-decline', { recursive: true });
await buildWeb(webJs);
await buildMobile(mobileJs);

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
@font-face{font-family:'MaterialCommunityIcons';src:url(/MaterialCommunityIcons.ttf) format('truetype');font-display:block}
@font-face{font-family:'material-community';src:url(/MaterialCommunityIcons.ttf) format('truetype');font-display:block}
html,body,#root{margin:0;background:#FAF9F7}
</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;

function listen(js, port) {
  const server = createServer((req, res) => {
    const url = req.url?.split('?')[0] ?? '/';
    if (url === '/hero.png') {
      res.setHeader('content-type', 'image/png');
      res.end(hero);
      return;
    }
    if (url === '/MaterialCommunityIcons.ttf') {
      res.setHeader('content-type', 'font/ttf');
      res.end(font);
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

const webServer = await listen(readFileSync(webJs), 8771);
const mobileServer = await listen(readFileSync(mobileJs), 8772);

const WEB = [
  ['review', '01-web-review'],
  ['decline-card', '02-web-decline-card'],
  ['decline-momo', '02b-web-decline-momo'],
  ['decline-momo-paid', '02c-web-decline-momo-paid'],
  ['cancelled-card', '03-web-cancelled-card'],
  ['cancelled-momo-refund', '03c-web-cancelled-momo-refund'],
  ['business', '04-web-business-detail'],
  ['push', '04-web-push-copy'],
  ['listing', '05-web-listing'],
  ['lightbox', '05b-web-lightbox'],
  ['refund-progress', '06-web-refund-progress'],
  ['refunded', '06-web-refunded'],
  ['insights', '07-web-insights'],
  ['admin', '07-web-admin'],
];

const MOBILE = [
  ['review', '01-review'],
  ['decline-card', '02-decline-card'],
  ['decline-momo', '02b-decline-momo'],
  ['decline-momo-paid', '02c-decline-momo-paid'],
  ['cancelled-card', '03-cancelled-card'],
  ['cancelled-momo', '03b-cancelled-momo'],
  ['cancelled-momo-refund', '03c-cancelled-momo-refund'],
  ['business', '04-business-detail'],
  ['listing', '05-listing'],
  ['lightbox', '05b-lightbox'],
  ['refund-progress', '06-refund-progress'],
  ['refunded', '06-refunded'],
  ['insights', '07-insights'],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  for (const lang of ['en', 'fr']) {
    for (const [scene, name] of WEB) {
      await shoot({ browser, lang, scene, file: `${name}-${lang}.png`, port: 8771, width: 1100, height: 900, mobile: false });
    }
    for (const [scene, name] of MOBILE) {
      await shoot({ browser, lang, scene, file: `${name}-${lang}.png`, port: 8772, width: 390, height: 1100, mobile: true });
    }
  }
  await shoot({ browser, lang: 'en', scene: 'push', file: '04-push-copy.png', port: 8772, width: 390, height: 900, mobile: true });
} finally {
  await browser.close();
  webServer.close();
  mobileServer.close();
}

async function shoot({ browser, lang, scene, file, port, width, height, mobile }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/?scene=${scene}&lang=${lang}`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.load('24px MaterialCommunityIcons');
    await document.fonts.load('24px material-community');
  });
  await page.waitForTimeout(200);
  await assertScene(page, scene, lang, mobile);
  const png = await page.screenshot({ type: 'png' });
  await writeCompressed(path.join(outDir, file), png);
  if (errors.length) throw new Error(`${file}: ${errors.slice(0, 3).join(' | ')}`);
  await page.close();
}

async function assertScene(page, scene, lang, mobile) {
  const text = await page.locator('body').innerText();
  if (scene.includes('momo') || scene.includes('refund')) {
    if (!text.includes('Douala')) throw new Error(`${scene} ${lang} is not the Douala fixture`);
    if (text.includes('CAD') || text.includes('CA$') || text.includes('$65')) throw new Error(`${scene} ${lang} used a CAD marker`);
    const showsAmount = scene.includes('paid') || scene.includes('refund');
    if (showsAmount && !text.includes('FCFA')) throw new Error(`${scene} ${lang} missing FCFA`);
  }
  if (scene === 'review' || scene === 'decline-card' || scene === 'cancelled-card') {
    const expected = lang === 'fr' ? '65,00' : '$65.00';
    if (!text.includes(expected)) throw new Error(`${scene} ${lang} money was ${JSON.stringify(text.slice(0, 180))}`);
    if (text.includes('CA$') || /\bCAD\b/.test(text)) throw new Error(`${scene} ${lang} showed CAD code`);
  }
  if (scene === 'listing' || scene === 'lightbox' || scene === 'review' || scene === 'business') {
    const day = lang === 'fr' ? '14 nov.' : '14 Nov';
    if (!text.includes(day)) throw new Error(`${scene} ${lang} date missing ${day}`);
    const stacked = await page.evaluate(() => {
      const img = document.querySelector('img') || document.querySelector('[aria-label]');
      const caption = [...document.querySelectorAll('p,span,div')].find((node) => {
        const own = [...node.childNodes].filter((child) => child.nodeType === 3).map((child) => child.textContent || '').join('');
        return /Captured|Prise le/.test(own);
      });
      if (!img || !caption) return false;
      return caption.getBoundingClientRect().top >= img.getBoundingClientRect().bottom - 2;
    });
    if (!stacked) throw new Error(`${scene} ${lang} caption is not under the photo`);
  }
  if (mobile && (scene.startsWith('decline') || scene.startsWith('cancelled') || scene.startsWith('refund'))) {
    const loaded = await page.evaluate(() => document.fonts.check('24px material-community'));
    if (!loaded) throw new Error(`${scene} icon font did not load`);
  }
  if (scene === 'admin' && !text.includes('5')) throw new Error('admin threshold copy missing 5');
}

async function writeCompressed(file, png) {
  let quality = 80;
  let buf = await sharp(png).png({ quality, compressionLevel: 9 }).toBuffer();
  while (buf.length > 300 * 1024 && quality > 40) {
    quality -= 10;
    buf = await sharp(png).resize({ width: 900, withoutEnlargement: true }).png({ quality, compressionLevel: 9 }).toBuffer();
  }
  if (buf.length > 300 * 1024) throw new Error(`${file} is ${buf.length} bytes`);
  await sharp(buf).toFile(file);
  console.log(`${path.basename(file)} ${buf.length}`);
}
