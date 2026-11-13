import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = '/opt/cursor/artifacts/charge-at-pickup-v1';
const repo = join(here, '../..');

const shots = [
  ['01-save-card-en', '01', 'en', 390, 844],
  ['01-save-card-fr', '01', 'fr', 390, 844],
  ['02-booking-before-pickup-en', '02', 'en', 390, 844],
  ['02-booking-before-pickup-fr', '02', 'fr', 390, 844],
  ['03-accept-and-start-en', '03', 'en', 390, 844],
  ['03-accept-and-start-fr', '03', 'fr', 390, 844],
  ['03-accept-and-start-en-360', '03', 'en', 360, 640],
  ['04-decline-pickup-en', '04', 'en', 390, 844],
  ['04-decline-pickup-fr', '04', 'fr', 390, 844],
  ['05-renewal-failed-en', '05', 'en', 390, 844],
  ['05-renewal-failed-fr', '05', 'fr', 390, 844],
  ['06-remainder-invoice-en', '06', 'en', 390, 844],
  ['06-remainder-invoice-fr', '06', 'fr', 390, 844],
  ['07-business-pickup-status-en', '07', 'en', 390, 844],
  ['07-business-pickup-status-fr', '07', 'fr', 390, 844],
  ['08-web-booking-before-pickup-en', '08', 'en', 1280, 740],
  ['08-web-booking-before-pickup-fr', '08', 'fr', 1280, 740],
];

const result = await esbuild.build({
  absWorkingDir: repo,
  entryPoints: [join(here, 'entry.tsx')],
  bundle: true,
  format: 'esm',
  outfile: join(here, 'bundle.js'),
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.json': 'json' },
  nodePaths: [join(repo, 'apps/frontend/node_modules'), join(repo, 'node_modules')],
});
if (result.errors.length) throw new Error(result.errors.map((e) => e.text).join('\n'));

const html = readFileSync(join(here, 'index.html'), 'utf8').replace('./entry.tsx', './bundle.js');
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/bundle.js') {
    res.setHeader('content-type', 'text/javascript');
    res.end(readFileSync(join(here, 'bundle.js')));
    return;
  }
  res.setHeader('content-type', 'text/html');
  res.end(html);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
for (const [name, screen, lang, width, height] of shots) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  await page.goto(`http://127.0.0.1:${port}/?screen=${screen}&lang=${lang}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  await page.close();
  console.log(name);
}
await browser.close();
server.close();
