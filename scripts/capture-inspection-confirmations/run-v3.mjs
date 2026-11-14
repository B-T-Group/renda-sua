/**
 * Screenshots of inspected-rental confirmations with the app fonts and icons.
 * Not imported by App.tsx, index.js, or the web entry.
 */
import * as esbuild from 'esbuild';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { buildMobile } from '../capture-accept-start/build-mobile.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const stub = path.join(root, 'scripts/capture-accept-start/stubs.tsx');
const hero = '/cursor/stores/bot/handoffs/inspection-confirmations/hero-jbl.png';
const outDir = '/tmp/capture-confirmations-v3';
const artifacts = '/opt/cursor/artifacts/inspection-confirmations/v3';
mkdirSync(outDir, { recursive: true });
mkdirSync(artifacts, { recursive: true });

const files = {
  '/Inter_400Regular.ttf': 'node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf',
  '/Inter_500Medium.ttf': 'node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf',
  '/Inter_600SemiBold.ttf': 'node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf',
  '/Inter_700Bold.ttf': 'node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf',
  '/Poppins_600SemiBold.ttf': 'node_modules/@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf',
  '/Poppins_700Bold.ttf': 'node_modules/@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf',
  '/icons.ttf': 'apps/mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf',
  '/inter-latin.woff2': 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  '/poppins-600.woff2': 'node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2',
  '/poppins-700.woff2': 'node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff2',
};

const aliases = [
  'SessionAuthContext',
  'UserProfileContext',
  'useIsStripeRail',
  'useRentalApi',
  'useClientFlags',
  'useRentalInspection',
  'useTrackSiteEvent',
  'UserMessagesComponent',
];

function isStubbedImport(importPath) {
  const base = importPath.split('/').pop() ?? '';
  const stem = base.replace(/\.(tsx|ts|jsx|js)$/, '');
  return aliases.includes(stem);
}

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ['scripts/capture-accept-start/app.tsx'],
  bundle: true,
  outfile: path.join(outDir, 'web.js'),
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  banner: { js: 'var process = { env: { NODE_ENV: "development" } };' },
  nodePaths: ['apps/frontend/node_modules', 'node_modules'],
  define: { 'process.env.NODE_ENV': '"development"' },
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.jpg': 'dataurl' },
  plugins: [
    {
      name: 'capture-stubs',
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => {
          if (isStubbedImport(args.path)) return { path: stub };
          if (args.path.endsWith('.css')) return { path: args.path, namespace: 'empty' };
          return null;
        });
        build.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' }));
      },
    },
  ],
});
await buildMobile(path.join(outDir, 'mobile.js'), 'scripts/capture-accept-start/mobile-app.tsx', {
  keepVectorIcons: true,
});

const css = `@font-face{font-family:Inter_400Regular;src:url(/Inter_400Regular.ttf) format('truetype');font-weight:400;font-display:block}
@font-face{font-family:Inter_500Medium;src:url(/Inter_500Medium.ttf) format('truetype');font-weight:500;font-display:block}
@font-face{font-family:Inter_600SemiBold;src:url(/Inter_600SemiBold.ttf) format('truetype');font-weight:600;font-display:block}
@font-face{font-family:Inter_700Bold;src:url(/Inter_700Bold.ttf) format('truetype');font-weight:700;font-display:block}
@font-face{font-family:Poppins_600SemiBold;src:url(/Poppins_600SemiBold.ttf) format('truetype');font-weight:600;font-display:block}
@font-face{font-family:Poppins_700Bold;src:url(/Poppins_700Bold.ttf) format('truetype');font-weight:700;font-display:block}
@font-face{font-family:material-community;src:url(/icons.ttf) format('truetype');font-weight:normal;font-style:normal;font-display:block}
@font-face{font-family:'Inter Variable';src:url(/inter-latin.woff2) format('woff2');font-weight:100 900;font-display:block}
@font-face{font-family:Poppins;src:url(/poppins-600.woff2) format('woff2');font-weight:600;font-display:block}
@font-face{font-family:Poppins;src:url(/poppins-700.woff2) format('woff2');font-weight:700;font-display:block}
html,body,#root{margin:0;background:#FAF9F7;font-family:Inter_400Regular,"Inter Variable",Inter,sans-serif}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
const heroBytes = readFileSync(hero);

function listen(js, port) {
  const server = createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    if (url.startsWith('/hero-jbl.png')) {
      res.setHeader('content-type', 'image/png');
      res.end(heroBytes);
      return;
    }
    const font = files[url];
    if (font) {
      res.setHeader('content-type', url.endsWith('.woff2') ? 'font/woff2' : 'font/ttf');
      res.end(readFileSync(path.join(root, font)));
      return;
    }
    if (url.startsWith('/app.js')) {
      res.setHeader('content-type', 'text/javascript');
      res.end(js);
      return;
    }
    res.setHeader('content-type', 'text/html');
    res.end(html);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

const webServer = await listen(readFileSync(path.join(outDir, 'web.js')), 8791);
const mobileServer = await listen(readFileSync(path.join(outDir, 'mobile.js')), 8792);
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const shots = [
  { file: '01-client-detail', scene: 'clientReview', en: 'Report ready to review', fr: 'État des lieux à vérifier', pill: 'client-pill' },
  { file: '02-report-sent', scene: 'reportSent', en: 'Condition report sent', fr: 'État des lieux envoyé' },
  { file: '03-business-waiting', scene: 'businessWait', en: 'Waiting for renter', fr: 'En attente du client', pill: 'business-pill' },
  { file: '04-rental-started', scene: 'rentalStarted', en: 'Rental started', fr: 'Location démarrée' },
  { file: '05-momo-started', scene: 'momoStarted', en: 'Payment confirmed', fr: 'Paiement confirmé' },
  { file: '06-rental-started-notice', scene: 'push', en: 'accepted the condition report', fr: "a accepté l'état des lieux" },
  { file: 'reserved-detail', scene: 'clientReview', en: 'Pay when you accept the condition report', fr: 'Payez lorsque vous acceptez', surfaces: ['mobile'] },
  { file: 'request-submitted', scene: 'requestSubmitted', en: 'No PIN is needed', fr: 'Aucun code PIN' },
  { file: 'started-notice', scene: 'push', en: 'Condition report accepted', fr: 'État des lieux accepté' },
];

const surfaces = [
  { name: 'mobile', port: 8792, width: 390 },
  { name: 'web', port: 8791, width: 1280 },
];

async function shrink(file) {
  const input = readFileSync(file);
  let quality = 80;
  let out = input;
  while (out.length > 300 * 1024 && quality >= 35) {
    out = await sharp(input).png({ quality, compressionLevel: 9, palette: true, effort: 8 }).toBuffer();
    quality -= 15;
  }
  if (out.length > 300 * 1024) {
    const meta = await sharp(input).metadata();
    const width = Math.max(390, Math.round((meta.width || 800) * 0.7));
    out = await sharp(input).resize({ width }).png({ quality: 55, compressionLevel: 9, palette: true }).toBuffer();
  }
  writeFileSync(file, out);
  if (out.length > 300 * 1024) throw new Error(`${path.basename(file)} is ${out.length} bytes`);
  console.log('size', path.basename(file), out.length);
}

try {
  for (const surface of surfaces) {
    for (const lang of ['en', 'fr']) {
      for (const shot of shots) {
        if (shot.surfaces && !shot.surfaces.includes(surface.name)) continue;
        const page = await browser.newPage({
          viewport: { width: surface.width, height: surface.name === 'mobile' ? 844 : 900 },
          deviceScaleFactor: 2,
        });
        page.on('pageerror', (err) => console.log('PAGEERROR', surface.name, shot.scene, lang, err.message));
        const request = shot.scene === 'requestSubmitted' ? '&requestId=req-1' : '';
        await page.goto(`http://127.0.0.1:${surface.port}/?scene=${shot.scene}&lang=${lang}${request}`, { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
          await document.fonts.load('16px Inter_400Regular');
          await document.fonts.load('16px "Inter Variable"');
          await document.fonts.ready;
        });
        const expected = lang === 'fr' ? shot.fr : shot.en;
        await page.getByText(expected).first().waitFor({ timeout: 20000 });
        const body = await page.locator('body').innerText();
        if (body.includes('📅')) throw new Error(`${shot.file} ${surface.name} still uses an emoji calendar`);
        const face = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
        if (/times|serif/i.test(face) && !/sans-serif/i.test(face)) {
          throw new Error(`${shot.file} ${surface.name} fell back to ${face}`);
        }
        if (shot.scene === 'momoStarted' && lang === 'fr') {
          if (!body.includes('retenue uniquement en cas de dommage')) throw new Error('missing recorded deposit');
          if (body.includes('bloquée')) throw new Error('MoMo still says the deposit is held');
          if (!body.includes('nov.')) throw new Error('French month is missing its period');
        }
        if (shot.scene === 'rentalStarted' && lang === 'fr' && !body.includes('nov.')) {
          throw new Error('French started date is missing its period');
        }
        const file = path.join(artifacts, `${shot.file}-${surface.name}-${lang}.png`);
        await page.screenshot({ path: file, fullPage: true });
        if (shot.pill) {
          const pill = path.join(artifacts, `${shot.pill}-${surface.name}-${lang}.png`);
          await page.getByText(expected).first().screenshot({ path: pill });
          await shrink(pill);
        }
        await shrink(file);
        await page.close();
        console.log('saved', path.basename(file));
      }
    }
  }
} finally {
  await browser.close();
  webServer.close();
  mobileServer.close();
}
