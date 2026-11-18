/**
 * Screenshots of the real support exclusion panel.
 * Nothing here is imported by the app entry points.
 *
 * Usage: node scripts/capture-decline-ranking/capture.mjs
 */
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { buildWeb } from './build.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const outDir = process.env.OUT_DIR ?? '/opt/cursor/artifacts/decline-ranking/v1';
const webJs = '/tmp/capture-decline-ranking/web.js';

mkdirSync(outDir, { recursive: true });
mkdirSync('/tmp/capture-decline-ranking', { recursive: true });
await buildWeb(webJs);
const js = readFileSync(webJs);

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body,#root{margin:0;background:#FAF9F7}</style>
</head><body><div id="root"></div><script src="/app.js"></script></body></html>`;

const server = createServer((req, res) => {
  const url = req.url?.split('?')[0] ?? '/';
  if (url === '/app.js') {
    res.setHeader('content-type', 'text/javascript');
    res.end(js);
    return;
  }
  res.setHeader('content-type', 'text/html');
  res.end(html);
});
await new Promise((resolve) => server.listen(8773, '127.0.0.1', () => resolve(undefined)));

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const shots = [
  ['off', 'en', '01-support-exclusion-off-en.png'],
  ['off', 'fr', '01-support-exclusion-off-fr.png'],
  ['on', 'en', '02-support-exclusion-on-en.png'],
  ['on', 'fr', '02-support-exclusion-on-fr.png'],
];

try {
  for (const [scene, lang, file] of shots) {
    await shoot(browser, scene, lang, file);
  }
} finally {
  await browser.close();
  server.close();
}

async function shoot(browser, scene, lang, file) {
  const page = await browser.newPage({ viewport: { width: 800, height: 520 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:8773/?scene=${scene}&lang=${lang}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  const text = await page.locator('body').innerText();
  const title = lang === 'fr' ? 'Pas la faute du commerce' : "Not the business's fault";
  if (!text.includes(title)) throw new Error(`${file} missing title`);
  if (!text.includes('RB-25496259')) throw new Error(`${file} missing booking`);
  const business = scene === 'on' ? '4' : '5';
  if (!text.includes(business) || !text.includes('6')) throw new Error(`${file} counts were ${JSON.stringify(text)}`);
  const checked = await page.locator('input[type="checkbox"]').isChecked();
  if (checked !== (scene === 'on')) throw new Error(`${file} toggle state`);
  if (scene === 'on') {
    const note = lang === 'fr' ? 'Dommage pendant le transport' : 'Damage in transit';
    const value = await page.locator('input').last().inputValue();
    if (value !== note) throw new Error(`${file} note was ${JSON.stringify(value)}`);
  }
  const png = await page.screenshot({ type: 'png' });
  await writeCompressed(path.join(outDir, file), png);
  if (errors.length) throw new Error(`${file}: ${errors.join(' | ')}`);
  await page.close();
}

async function writeCompressed(file, png) {
  let buf = await sharp(png).png({ compressionLevel: 9 }).toBuffer();
  if (buf.length > 300 * 1024) {
    buf = await sharp(png).resize({ width: 720, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
  }
  if (buf.length > 300 * 1024) throw new Error(`${file} is ${buf.length} bytes`);
  await sharp(buf).toFile(file);
  console.log(`${path.basename(file)} ${buf.length}`);
}
