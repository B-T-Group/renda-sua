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
const decline1 = await sharp({ create: { width: 320, height: 320, channels: 3, background: { r: 176, g: 48, b: 36 } } }).png().toBuffer();
const decline2 = await sharp({ create: { width: 320, height: 320, channels: 3, background: { r: 20, g: 78, b: 150 } } }).png().toBuffer();
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
    if (url === '/hero.png' || url === '/decline-1.png' || url === '/decline-2.png') {
      res.setHeader('content-type', 'image/png');
      res.end(url === '/decline-1.png' ? decline1 : url === '/decline-2.png' ? decline2 : hero);
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
  ['decline-other', '02d-web-decline-other'],
  ['decline-other-filled', '02e-web-decline-other-filled'],
  ['decline-photos', '02f-web-decline-photos'],
  ['cancelled-card', '03-web-cancelled-card'],
  ['cancelled-momo-refund', '03c-web-cancelled-momo-refund'],
  ['xaf-wallet', '03d-web-xaf-wallet'],
  ['xaf-card', '03e-web-xaf-card'],
  ['xaf-unpaid', '03f-web-xaf-unpaid'],
  ['refund-nophone', '03g-web-refund-nophone'],
  ['business', '04-web-business-detail'],
  ['push', '04-web-push-copy'],
  ['listing', '05-web-listing'],
  ['lightbox', '05b-web-lightbox'],
  ['refund-progress', '06-web-refund-progress'],
  ['refunded', '06-web-refunded'],
  ['refund-failed', '06b-web-refund-failed'],
  ['refund-manual', '06c-web-refund-manual'],
  ['insights', '07-web-insights'],
  ['admin', '07-web-admin'],
];

const MOBILE = [
  ['review', '01-review'],
  ['decline-card', '02-decline-card'],
  ['decline-momo', '02b-decline-momo'],
  ['decline-momo-paid', '02c-decline-momo-paid'],
  ['decline-other', '02d-decline-other'],
  ['decline-other-filled', '02e-decline-other-filled'],
  ['decline-photos', '02f-decline-photos'],
  ['cancelled-card', '03-cancelled-card'],
  ['cancelled-momo', '03b-cancelled-momo'],
  ['cancelled-momo-refund', '03c-cancelled-momo-refund'],
  ['xaf-wallet', '03d-xaf-wallet'],
  ['xaf-card', '03e-xaf-card'],
  ['xaf-unpaid', '03f-xaf-unpaid'],
  ['refund-nophone', '03g-refund-nophone'],
  ['business', '04-business-detail'],
  ['listing', '05-listing'],
  ['lightbox', '05b-lightbox'],
  ['refund-progress', '06-refund-progress'],
  ['refunded', '06-refunded'],
  ['refund-failed', '06b-refund-failed'],
  ['refund-manual', '06c-refund-manual'],
  ['insights', '07-insights'],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  for (const lang of ['en', 'fr']) {
    if (process.env.ONLY !== 'mobile') for (const [scene, name] of WEB) {
      if (process.env.SCENE && !process.env.SCENE.split(',').includes(scene)) continue;
      const tall = scene === 'listing' || scene === 'insights' || scene === 'business' || scene.startsWith('decline');
      await shoot({ browser, lang, scene, file: `${name}-${lang}.png`, port: 8771, width: 1100, height: tall ? 1400 : 900, mobile: false });
    }
    if (process.env.ONLY === 'web') continue;
    for (const [scene, name] of MOBILE) {
      if (process.env.SCENE && !process.env.SCENE.split(',').includes(scene)) continue;
      const tall = scene === 'insights' || scene === 'business' || scene.startsWith('decline');
      await shoot({ browser, lang, scene, file: `${name}-${lang}.png`, port: 8772, width: 390, height: tall ? 1600 : 1100, mobile: true });
    }
  }
  if (!process.env.SCENE) {
    await shoot({ browser, lang: 'en', scene: 'push', file: '04-push-copy.png', port: 8772, width: 390, height: 900, mobile: true });
  }
} finally {
  await browser.close();
  webServer.close();
  mobileServer.close();
}

async function shoot({ browser, lang, scene, file, port, width, height, mobile }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack || error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(`http://127.0.0.1:${port}/?scene=${scene}&lang=${lang}`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.load('24px MaterialCommunityIcons');
    await document.fonts.load('24px material-community');
  });
  await page.waitForTimeout(200);
  if (errors.length) throw new Error(`${file}: ${errors.slice(0, 4).join(' | ')}`);
  const preview = await page.evaluate(() => document.body.innerText.slice(0, 80) || document.body.innerHTML.slice(0, 400));
  if (!preview.trim() || preview.startsWith('<')) throw new Error(`${file} blank: ${preview}`);
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
  if (scene === 'review' || scene === 'decline-card' || scene === 'cancelled-card' || scene.startsWith('decline-other') || scene === 'decline-photos') {
    const expected = lang === 'fr' ? '65,00' : '$65.00';
    if (!text.includes(expected)) throw new Error(`${scene} ${lang} money was ${JSON.stringify(text.slice(0, 180))}`);
    if (text.includes('CA$') || /\bCAD\b/.test(text)) throw new Error(`${scene} ${lang} showed CAD code`);
  }
  if (scene === 'review') {
    const hold = lang === 'fr' ? 'Empreinte carte' : 'Card hold:';
    if (!text.includes(hold)) throw new Error(`${scene} ${lang} missing the card hold line`);
    if (/is released|est libérée|libérée/i.test(text)) throw new Error(`${scene} ${lang} showed the release line`);
  }
  if (scene === 'decline-card' || scene.startsWith('decline-other') || scene === 'decline-photos') {
    const release = lang === 'fr' ? 'empreinte' : 'is released';
    if (!text.toLowerCase().includes(release)) throw new Error(`${scene} ${lang} missing the release line`);
  }
  if (scene === 'decline-other' || scene === 'decline-other-filled') {
    const label = lang === 'fr' ? 'Refuser' : 'Decline';
    const box = await page.getByRole('button', { name: label, exact: true }).boundingBox();
    if (!box) throw new Error(`${scene} ${lang} Decline button missing`);
    const sample = await page.screenshot({
      clip: { x: box.x + 14, y: box.y + box.height / 2 - 2, width: 4, height: 4 },
    });
    const { data } = await sharp(sample).raw().toBuffer({ resolveWithObject: true });
    const grey = data[0] > 180 && data[1] > 180 && data[2] > 180;
    const red = data[0] > 140 && data[1] < 90 && data[2] < 90;
    if (scene === 'decline-other' && !grey) throw new Error(`${scene} ${lang} Decline is not greyed (${data[0]},${data[1]},${data[2]})`);
    if (scene === 'decline-other-filled' && !red) throw new Error(`${scene} ${lang} Decline is not enabled (${data[0]},${data[1]},${data[2]})`);
    if (scene === 'decline-other-filled') {
      const values = await page.locator('textarea, input').evaluateAll((nodes) => nodes.map((node) => node.value || ''));
      const shown = text.includes('speaker cone') || values.some((value) => value.includes('speaker cone'));
      if (!shown) throw new Error(`${scene} ${lang} missing the other note (${JSON.stringify(values)})`);
    }
  }
  if (scene === 'decline-photos') {
    const images = await page.locator('img').count();
    if (images < 2) throw new Error(`${scene} ${lang} expected two thumbnails, saw ${images}`);
    const remove = lang === 'fr' ? 'Retirer la photo' : 'Remove photo';
    const removes = await page.locator(`[aria-label="${remove}"]`).count();
    if (!text.includes(remove) && removes < 2) throw new Error(`${scene} ${lang} missing remove`);
  }
  if (scene === 'business') {
    const reason = lang === 'fr' ? 'Motif' : 'Reason:';
    const renter = lang === 'fr' ? 'Photos du locataire' : "Renter's photos";
    const yours = lang === 'fr' ? 'Vos photos de retrait' : 'Your pickup photos';
    const link = lang === 'fr' ? 'Voir la réservation' : 'View booking';
    const note = lang === 'fr' ? 'fissurée' : 'grille is cracked';
    for (const bit of [reason, renter, yours, link, note]) {
      if (!text.includes(bit)) throw new Error(`${scene} ${lang} missing ${bit}`);
    }
    if (text.includes('Unit freed') || text.includes('Unité libérée')) throw new Error(`${scene} ${lang} still shows Unit freed`);
    const photo1 = lang === 'fr' ? 'Photo 1 · 18 nov.' : 'Photo 1 · 18 Nov';
    const photo2 = lang === 'fr' ? 'Photo 2 · 18 nov.' : 'Photo 2 · 18 Nov';
    if (!text.includes(photo1) || !text.includes(photo2)) throw new Error(`${scene} ${lang} missing numbered decline captions`);
    const srcs = await page.locator('img').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src') || ''));
    if (!srcs.includes('/decline-1.png') || !srcs.includes('/decline-2.png')) {
      throw new Error(`${scene} ${lang} decline photos are not distinct`);
    }
    if ((text.match(/Overview|Vue d’ensemble/g) || []).length > 1) {
      throw new Error(`${scene} ${lang} used a baseline role on a renter photo`);
    }
  }
  if (scene === 'listing') {
    const header = lang === 'fr' ? "Photos d'état" : 'Condition photos';
    const by = lang === 'fr' ? 'Prises par le commerce' : 'Taken by the business';
    if (!text.includes(header) || !text.includes(by)) throw new Error(`${scene} ${lang} missing listing header`);
    if (!text.includes('About this rental') && !text.includes('À propos')) {
      throw new Error(`${scene} ${lang} is not inside the listing page`);
    }
  }
  if (scene === 'insights') {
    const welcome = lang === 'fr' ? 'tableau' : 'dashboard';
    const stat = lang === 'fr' ? 'Refus' : 'Condition declines';
    if (!text.toLowerCase().includes(welcome) && !text.includes('Performance') && !text.includes('Disponibilité')) {
      throw new Error(`${scene} ${lang} is not inside the insights page`);
    }
    if (!text.includes('2') || !text.includes(stat)) throw new Error(`${scene} ${lang} missing the decline stat`);
  }
  if (scene === 'admin') {
    if (!text.includes('Marie Ngo') || !text.includes('6')) throw new Error('admin row is not Marie Ngo / 6');
  }
  if (scene === 'cancelled-card' || scene === 'decline-card') {
    const label = scene === 'decline-card'
      ? (lang === 'fr' ? 'Continuer l’examen' : 'Keep reviewing')
      : (lang === 'fr' ? 'Parcourir les locations' : 'Browse rentals');
    if (mobile && scene === 'cancelled-card') {
      const swatch = await page.getByRole('button', { name: label, exact: true }).boundingBox();
      if (!swatch) throw new Error(`${scene} ${lang} missing ${label}`);
      const chip = await page.screenshot({ clip: { x: swatch.x + 14, y: swatch.y + swatch.height / 2 - 2, width: 4, height: 4 } });
      const { data: px } = await sharp(chip).raw().toBuffer({ resolveWithObject: true });
      const blue = px[2] > 140 && px[0] < 40 && px[1] < 120;
      if (!blue) throw new Error(`${scene} ${lang} is not primary blue (${px[0]},${px[1]},${px[2]})`);
    } else {
      const paint = await page.evaluate((name) => {
        const el = [...document.querySelectorAll('button,[role="button"]')].find((node) => (node.textContent || '').includes(name));
        if (!el) return '';
        return [el, ...el.querySelectorAll('*')]
          .map((node) => `${getComputedStyle(node).color}|${getComputedStyle(node).backgroundColor}`)
          .join(' ');
      }, label);
      if (!paint.includes('10, 79, 181')) throw new Error(`${scene} ${lang} is not primary blue (${paint})`);
    }
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
  if (scene === 'refund-failed' || scene === 'refund-manual') {
    const body = lang === 'fr' ? 'portefeuille Rendasua' : 'Rendasua wallet';
    const primary = lang === 'fr' ? 'Voir le portefeuille' : 'View wallet';
    const secondary = lang === 'fr' ? 'Parcourir les locations' : 'Browse rentals';
    for (const bit of [body, primary, secondary]) {
      if (!text.includes(bit)) throw new Error(`${scene} ${lang} missing ${bit}`);
    }
    if (text.includes('670') || text.toLowerCase().includes('phone')) {
      throw new Error(`${scene} ${lang} still names the phone`);
    }
  }
  if (scene === 'xaf-wallet' || scene === 'xaf-card' || scene === 'xaf-unpaid' || scene === 'refund-nophone') {
    if (text.includes('to .') || text.includes('au .')) throw new Error(`${scene} ${lang} shows an empty phone`);
  }
  if (scene === 'xaf-wallet' && !text.toLowerCase().includes(lang === 'fr' ? 'portefeuille' : 'wallet')) {
    throw new Error(`${scene} ${lang} is not the wallet copy`);
  }
  if (scene === 'xaf-unpaid' && !text.toLowerCase().includes(lang === 'fr' ? 'rien payé' : "haven't paid")) {
    throw new Error(`${scene} ${lang} is not the unpaid copy`);
  }
  if (scene === 'xaf-card' && !text.toLowerCase().includes(lang === 'fr' ? 'carte' : 'card')) {
    throw new Error(`${scene} ${lang} is not the card copy`);
  }
  if (scene === 'refund-nophone' && (text.includes('67') || text.includes('to .') || text.includes('au .'))) {
    throw new Error(`${scene} ${lang} still names a phone`);
  }
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
