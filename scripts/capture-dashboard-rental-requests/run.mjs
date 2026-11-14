/**
 * Capture harness for the business rental-request screens.
 * Not imported by the web or mobile app entry.
 *
 * Usage: node scripts/capture-dashboard-rental-requests/run.mjs [html] [outDir]
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const htmlPath = process.argv[2] || '/tmp/rental-mockups/dashboard-rental-requests/index.html';
const outDir = process.argv[3] || '/opt/cursor/artifacts/dashboard-rental-requests/v1';

const names = {
  m01: '01-dashboard-mobile',
  m02: '02-accept-mobile',
  m03: '03-decline-mobile',
  m04: '04-empty-mobile',
  m05: '05-after-accept-mobile',
  m06: '06-expired-business-mobile',
  c06: '06-expired-renter-mobile',
  w01: '01-dashboard-web',
  w02: '02-accept-web',
  w03: '03-decline-web',
  w04: '04-empty-web',
  w05: '05-after-accept-web',
  w06: '06-expired-business-web',
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.goto(`file://${path.resolve(htmlPath)}`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await mkdir(outDir, { recursive: true });

for (const [id, stem] of Object.entries(names)) {
  for (const lang of ['en', 'fr']) {
    const handle = page.locator(`#${id}-${lang}`);
    const png = await handle.screenshot({ type: 'png' });
    const file = path.join(outDir, `${stem}-${lang}.png`);
    await sharp(png).png({ compressionLevel: 9, palette: true, quality: 80, effort: 10 }).toFile(file);
  }
}

await browser.close();
console.log(outDir);
