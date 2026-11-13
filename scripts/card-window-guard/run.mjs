/**
 * Screenshots of the card date guard. Uses the real date sheet, notice,
 * and web calendar. Not imported by App.tsx, index.js, or the web entry.
 */
import * as esbuild from 'esbuild';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { buildMobile } from '../capture-accept-start/build-mobile.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const out = '/opt/cursor/artifacts/card-window-guard-v2';
const inter = '/tmp/card-mocks/card-window-guard/Inter-Variable.ttf';
const icons = path.join(
  root,
  'apps/mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'
);
mkdirSync(out, { recursive: true });

await buildMobile('/tmp/card-window-mobile.js', 'scripts/card-window-guard/mobile-app.tsx', {
  keepVectorIcons: true,
});

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ['scripts/card-window-guard/web-app.tsx'],
  bundle: true,
  outfile: '/tmp/card-window-web.js',
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  banner: { js: 'var process = { env: { NODE_ENV: "development" } };' },
  nodePaths: ['apps/frontend/node_modules', 'node_modules'],
  define: { 'process.env.NODE_ENV': '"development"' },
});

const css = `@font-face{font-family:Inter;src:url(/inter.ttf) format('truetype');font-weight:100 900;}
@font-face{font-family:material-community;src:url(/icons.ttf) format('truetype');font-weight:normal;font-style:normal;font-display:block;}
html,body,#root{margin:0;height:100%;font-family:Inter,sans-serif;background:#FAF9F7}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;

function listen(js) {
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/app.js')) {
      res.setHeader('content-type', 'text/javascript');
      res.end(js);
      return;
    }
    if (req.url?.startsWith('/inter.ttf')) {
      res.setHeader('content-type', 'font/ttf');
      res.end(readFileSync(inter));
      return;
    }
    if (req.url?.startsWith('/icons.ttf')) {
      res.setHeader('content-type', 'font/ttf');
      res.end(readFileSync(icons));
      return;
    }
    res.setHeader('content-type', 'text/html');
    res.end(html);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const phoneJs = readFileSync('/tmp/card-window-mobile.js');
const webJs = readFileSync('/tmp/card-window-web.js');
const phone = await listen(phoneJs);
const web = await listen(webJs);
const phonePort = phone.address().port;
const webPort = web.address().port;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });

const shots = [
  ['02-datepicker-momo-en', 'phone', '02', 'en', 390, 844],
  ['02-datepicker-momo-fr', 'phone', '02', 'fr', 390, 844],
  ['03-summary-unfit-en', 'phone', '03', 'en', 390, 844],
  ['03-summary-unfit-fr', 'phone', '03', 'fr', 390, 844],
  ['04-fallback-en', 'phone', '04', 'en', 390, 844],
  ['04-fallback-fr', 'phone', '04', 'fr', 390, 844],
  ['07-web-summary-unfit-en', 'web', '07', 'en', 1280, 800],
  ['07-web-summary-unfit-fr', 'web', '07', 'fr', 1280, 800],
  ['08-assistant-unfit-en', 'phone', '08', 'en', 390, 844],
  ['08-assistant-unfit-fr', 'phone', '08', 'fr', 390, 844],
];

for (const [name, kind, scene, lang, width, height] of shots) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  const port = kind === 'web' ? webPort : phonePort;
  await page.goto(`http://127.0.0.1:${port}/?scene=${scene}&lang=${lang}`, { waitUntil: 'networkidle' });
  const fontReady = await page.evaluate(async () => {
    await document.fonts.load("20px material-community");
    return document.fonts.check("20px material-community");
  });
  if (!fontReady && name.endsWith('-en')) console.log('font missing', name);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  await page.close();
  console.log(name);
}

await browser.close();
phone.close();
web.close();
console.log(out);
