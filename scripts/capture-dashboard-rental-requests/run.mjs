/**
 * Screenshots of the real rental-request components.
 * Not imported by App.tsx, index.js, or the web entry.
 *
 * Usage: node scripts/capture-dashboard-rental-requests/run.mjs [outDir]
 */
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { buildMobile, buildWeb } from './build.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = process.argv[2] || '/opt/cursor/artifacts/dashboard-rental-requests/v2';
const tmp = '/tmp/capture-drr';
mkdirSync(tmp, { recursive: true });
mkdirSync(outDir, { recursive: true });
const itemPhoto = path.join(import.meta.dirname, 'item-photo.png');

await buildWeb(path.join(tmp, 'web.js'));
await buildMobile(path.join(tmp, 'mobile.js'));
const bundles = { web: readFileSync(path.join(tmp, 'web.js')), mobile: readFileSync(path.join(tmp, 'mobile.js')) };

const iconFont = path.join(
  root,
  'apps/mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'
);

function html(kind, scene, lang) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body,#root{margin:0;background:#FAF9F7}
@font-face{font-family:'material-community';src:url('/fonts/MaterialCommunityIcons.ttf') format('truetype');font-weight:normal;font-style:normal;}
</style></head><body><div id="root"></div><script>window.__SCENE=${JSON.stringify(scene)};window.__LANG=${JSON.stringify(lang)};window.process={env:{NODE_ENV:"production"}};</script><script src="/${kind}.js"></script></body></html>`;
}

function listen(port) {
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/item-photo.png') {
      res.setHeader('content-type', 'image/png');
      res.end(readFileSync(itemPhoto));
      return;
    }
    if (url.pathname === '/fonts/MaterialCommunityIcons.ttf') {
      res.setHeader('content-type', 'font/ttf');
      res.end(readFileSync(iconFont));
      return;
    }
    if (url.pathname === '/web.js' || url.pathname === '/mobile.js') {
      res.setHeader('content-type', 'text/javascript');
      res.end(bundles[url.pathname === '/web.js' ? 'web' : 'mobile']);
      return;
    }
    const kind = url.searchParams.get('kind') === 'mobile' ? 'mobile' : 'web';
    res.setHeader('content-type', 'text/html');
    res.end(html(kind, url.searchParams.get('scene') || 'dashboard', url.searchParams.get('lang') || 'en'));
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

const server = await listen(4177);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const shots = [
  ['web', 'dashboard', '01-dashboard-web', 1040, 900],
  ['mobile', 'dashboard', '01-dashboard-mobile', 390, 844],
  ['web', 'dashboard', '02-accept-web', 1040, 900, 'accept'],
  ['mobile', 'dashboard', '02-accept-mobile', 390, 844, 'accept'],
  ['web', 'hours', '02-accept-hours-web', 1040, 980, 'accept'],
  ['mobile', 'hours', '02-accept-hours-mobile', 390, 980, 'accept'],
  ['web', 'dashboard', '03-decline-web', 1040, 900, 'decline'],
  ['mobile', 'dashboard', '03-decline-mobile', 390, 844, 'decline'],
  ['web', 'after', '05-after-accept-web', 1040, 900],
  ['mobile', 'after', '05-after-accept-mobile', 390, 844],
  ['web', 'expired', '06-expired-business-web', 1040, 900],
  ['mobile', 'expired', '06-expired-business-mobile', 390, 844],
  ['web', 'renter', '06-expired-renter-web', 1040, 640],
  ['mobile', 'renter', '06-expired-renter-mobile', 390, 640],
  ['web', 'list', '07-requests-list-web', 1100, 1100],
  ['mobile', 'list', '07-requests-list-mobile', 390, 844],
  ['web', 'conflict', '08-accept-disabled-web', 1040, 520],
  ['mobile', 'conflict', '08-accept-disabled-mobile', 390, 520],
  ['web', 'updated', '09-updated-web', 1040, 420],
  ['mobile', 'updated', '09-updated-mobile', 390, 520],
  ['mobile', 'detail', '10-detail-mobile', 390, 844],
  ['mobile', 'dashboard', '11-amber-mobile', 390, 844],
];

async function shoot(page, kind, scene, stem, lang, width, height, action) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack || error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.addInitScript(() => {
    window.__captureErrors = [];
    window.addEventListener('error', (event) => window.__captureErrors.push(String(event.error?.stack || event.message)));
  });
  await page.setViewportSize({ width, height });
  await page.goto(`http://127.0.0.1:4177/?kind=${kind}&scene=${scene}&lang=${lang}`, { waitUntil: 'load' });
  try {
    await page.waitForSelector('body[data-ready="1"]', { state: 'attached', timeout: 20000 });
  } catch (error) {
    console.error((errors[0] || 'no page error').split('\n').slice(0, 8).join('\n'));
    throw error;
  }
  if (action) {
    const label = action === 'accept' ? (lang === 'fr' ? 'Accepter' : 'Accept') : lang === 'fr' ? 'Refuser' : 'Decline';
    await page.getByLabel(label).first().click();
    const title = action === 'accept'
      ? (lang === 'fr' ? 'Confirmer la disponibilité' : 'Confirm availability')
      : (lang === 'fr' ? 'Refuser la demande' : 'Decline request');
    await page.getByText(title).first().waitFor({ timeout: 8000 });
  }
  if (errors.length) console.error(errors[0].split('\n').slice(0, 6).join('\n'));
  await page.waitForTimeout(200);
  const png = await page.screenshot({ fullPage: true, type: 'png' });
  const file = path.join(outDir, `${stem}-${lang}.png`);
  await sharp(png).png({ compressionLevel: 9, effort: 10 }).toFile(file);
  let size = statSync(file).size;
  if (size > 300 * 1024) {
    await sharp(png).png({ compressionLevel: 9, palette: true, quality: 70, effort: 10 }).toFile(file);
    size = statSync(file).size;
  }
  console.log(`${file} ${size} ${errors[0] ? 'ERR ' + errors[0].split('\n')[0] : 'ok'}`);
}

for (const [kind, scene, stem, width, height, action] of shots) {
  for (const lang of ['en', 'fr']) {
    const page = await browser.newPage();
    try {
      await shoot(page, kind, scene, stem, lang, width, height, action);
    } catch (error) {
      const text = await page.locator('#root').innerText().catch(() => '');
      const logged = await page.evaluate(() => window.__captureErrors || []).catch(() => []);
      console.error('FAIL', stem, lang, error.message, text.slice(0, 400), logged.join(' | ').slice(0, 500));
    }
    await page.close();
  }
}

await browser.close();
await server.close();
console.log(outDir);
