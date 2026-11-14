import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const source = process.env.MOCKUP_HTML
  ?? '/tmp/inspection-optin-mockups/inspection-optin/index.html';
const outDir = process.env.OUT_DIR ?? '/opt/cursor/artifacts/inspection-optin/v1';
const damageCopy = {
  en: {
    title: 'Reuse photos from last rental',
    note: 'The last return reported damage.',
  },
  fr: {
    title: 'Réutiliser les photos de la dernière location',
    note: 'Le dernier retour a signalé un dommage.',
  },
};

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.goto(`file://${source}`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts?.ready);
const shots = await page.$$eval('[data-shot]', (nodes) => nodes.map((node) => node.getAttribute('data-shot')));
for (const name of shots) {
  const node = page.locator(`[data-shot="${name}"]`).first();
  await writeCompressed(path.join(outDir, `${name}.png`), await node.screenshot({ type: 'png' }));
}
for (const name of shots.filter((shot) => shot.startsWith('04-'))) {
  const lang = name.endsWith('-fr') ? 'fr' : 'en';
  const copy = damageCopy[lang];
  await page.evaluate(({ shot, copy: text }) => {
    const node = document.querySelector(`[data-shot="${shot}"] .reuse`);
    if (!node) return;
    node.setAttribute('data-damage', '1');
    node.style.opacity = '0.45';
    const title = node.querySelector('h4');
    const note = node.querySelector('p');
    if (title) title.textContent = text.title;
    if (note) note.textContent = text.note;
  }, { shot: name, copy });
  const file = name.replace('04-', '04-damage-');
  const png = await page.locator(`[data-shot="${name}"]`).first().screenshot({ type: 'png' });
  await writeCompressed(path.join(outDir, `${file}.png`), png);
}
await browser.close();

async function writeCompressed(file, png) {
  let width = null;
  let buf = png;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let pipeline = sharp(png);
    if (width) pipeline = pipeline.resize({ width, withoutEnlargement: true });
    buf = await pipeline.png({ compressionLevel: 9, palette: true, quality: 60 }).toBuffer();
    if (buf.length <= 300 * 1024) break;
    width = width ? Math.floor(width * 0.85) : 1000;
  }
  await writeFile(file, buf);
  console.log(`${path.basename(file)} ${buf.length}`);
}
