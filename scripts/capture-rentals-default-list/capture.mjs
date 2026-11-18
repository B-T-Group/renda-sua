/**
 * Screenshots of the real RentalSearchFirstScreen and the real /rentals page.
 * This script is not imported by apps/mobile/App.tsx, index.js, or the web entry.
 *
 * Usage: node scripts/capture-rentals-default-list/capture.mjs
 */
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { buildMobile, buildWeb } from './build.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const outDir = process.env.OUT_DIR ?? '/opt/cursor/artifacts';
const tmp = '/tmp/capture-rentals-default-list';
const fontPath = path.resolve(
  import.meta.dirname,
  '../../apps/mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'
);

mkdirSync(outDir, { recursive: true });
mkdirSync(tmp, { recursive: true });

const mobileJsPath = path.join(tmp, 'mobile.js');
const webJsPath = path.join(tmp, 'web.js');
await buildMobile(mobileJsPath);
await buildWeb(webJsPath);
const mobileJs = readFileSync(mobileJsPath);
const webJs = readFileSync(webJsPath);
const font = readFileSync(fontPath);

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
@font-face { font-family: material-community; src: url(/MaterialCommunityIcons.ttf) format('truetype'); font-weight: normal; font-style: normal; }
@font-face { font-family: MaterialCommunityIcons; src: url(/MaterialCommunityIcons.ttf) format('truetype'); font-weight: normal; font-style: normal; }
html,body,#root{margin:0;background:#FAF9F7}
</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;

const scenes = [
  ['douala', 'en', '01-landing-douala'],
  ['douala', 'fr', '01-landing-douala'],
  ['toronto', 'en', '01-landing-toronto'],
  ['toronto', 'fr', '01-landing-toronto'],
  ['loading', 'en', '02-loading'],
  ['loading', 'fr', '02-loading'],
  ['empty', 'en', '03-empty'],
  ['empty', 'fr', '03-empty'],
  ['search', 'en', '04-search'],
  ['search', 'fr', '04-search'],
];

const server = createServer((req, res) => {
  const url = req.url?.split('?')[0] ?? '/';
  if (url === '/app.js') {
    const kind = req.headers['x-capture-kind'];
    res.setHeader('content-type', 'text/javascript');
    res.end(kind === 'web' ? webJs : mobileJs);
    return;
  }
  if (url === '/MaterialCommunityIcons.ttf') {
    res.setHeader('content-type', 'font/ttf');
    res.end(font);
    return;
  }
  res.setHeader('content-type', 'text/html');
  res.end(html);
});
await new Promise((resolve) => server.listen(8774, '127.0.0.1', () => resolve(undefined)));

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  for (const [scene, lang, stem] of scenes) {
    await shoot(browser, 'mobile', scene, lang, `${stem}-mobile-${lang}.png`);
    await shoot(browser, 'web', scene, lang, `${stem}-web-${lang}.png`);
  }
} finally {
  await browser.close();
  server.close();
}

async function shoot(browser, kind, scene, lang, file) {
  const mobile = kind === 'mobile';
  const page = await browser.newPage({
    viewport: mobile ? { width: 390, height: 1100 } : { width: 1280, height: 1100 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.setExtraHTTPHeaders({ 'x-capture-kind': kind });
  await page.goto(`http://127.0.0.1:8774/?scene=${scene}&lang=${lang}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(scene === 'loading' ? 400 : 500);
  const text = await page.locator('body').innerText();
  if (errors.length) throw new Error(`${file}: ${errors.join(' | ')}\n${text.slice(0, 800)}`);
  assertScene(file, scene, lang, text);
  const png = await page.screenshot({ type: 'png', fullPage: true });
  await cropBottom(png, path.join(outDir, file));
  console.log(file);
  await page.close();
}

async function cropBottom(png, file) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let last = height - 1;
  for (let y = height - 1; y >= 0; y -= 1) {
    let blank = true;
    for (let x = 0; x < width; x += 3) {
      const i = (y * width + x) * channels;
      if (data[i] < 246 || data[i + 1] < 244 || data[i + 2] < 240) {
        blank = false;
        break;
      }
    }
    if (!blank) {
      last = y;
      break;
    }
  }
  const cropped = Math.min(height, last + 36);
  await sharp(png).extract({ left: 0, top: 0, width, height: cropped }).png().toFile(file);
}

function assertScene(file, scene, lang, text) {
  const fr = lang === 'fr';
  if (text.includes('TypeError') || text.includes('is not a function')) {
    throw new Error(`${file} rendered an error:\n${text.slice(0, 500)}`);
  }
  if (scene === 'loading') {
    if (text.toLowerCase().includes('sony')) throw new Error(`${file} showed a card while loading`);
    return;
  }
  if (scene === 'empty') {
    const title = fr ? 'Aucune location ici pour le moment' : 'No rentals here yet';
    if (!text.includes(title)) throw new Error(`${file} missing empty state`);
    if (!text.includes('Yaoundé')) throw new Error(`${file} missing Yaoundé`);
    return;
  }
  if (scene === 'search') {
    if (!text.includes('Canon EOS R6')) throw new Error(`${file} missing search hit`);
    return;
  }
  if (!text.includes('Sony A7 IV kit')) throw new Error(`${file} missing default list\n${text.slice(0, 1500)}`);
  const place = scene === 'toronto' ? 'Toronto' : 'Douala';
  if (!text.includes(place)) throw new Error(`${file} missing ${place}`);
}
