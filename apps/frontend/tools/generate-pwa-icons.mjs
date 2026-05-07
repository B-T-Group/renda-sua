import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const SRC_SVG = path.join(ROOT, 'src', 'assets', 'rendasua.svg');
const ASSETS_DIR = path.join(ROOT, 'src', 'assets', 'pwa');

/**
 * Extract embedded base64 PNG from the SVG at `SRC_SVG`.
 * The current SVG contains a `data:image/png;base64,...` payload.
 */
async function extractEmbeddedPngBuffer() {
  const svg = await fs.readFile(SRC_SVG, 'utf8');
  const match = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
  if (!match?.[1]) {
    throw new Error(`No embedded PNG found in ${SRC_SVG}`);
  }
  return Buffer.from(match[1], 'base64');
}

function resizeNearestNeighbor(srcPng, targetSize) {
  const out = new PNG({ width: targetSize, height: targetSize });
  const srcW = srcPng.width;
  const srcH = srcPng.height;
  const srcData = srcPng.data;
  const outData = out.data;

  for (let y = 0; y < targetSize; y++) {
    const srcY = Math.min(srcH - 1, Math.floor((y / targetSize) * srcH));
    for (let x = 0; x < targetSize; x++) {
      const srcX = Math.min(srcW - 1, Math.floor((x / targetSize) * srcW));

      const srcIdx = (srcW * srcY + srcX) << 2;
      const outIdx = (targetSize * y + x) << 2;

      outData[outIdx] = srcData[srcIdx];
      outData[outIdx + 1] = srcData[srcIdx + 1];
      outData[outIdx + 2] = srcData[srcIdx + 2];
      outData[outIdx + 3] = srcData[srcIdx + 3];
    }
  }

  return out;
}

async function writePng(filePath, png) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const buffer = PNG.sync.write(png);
  await fs.writeFile(filePath, buffer);
}

async function main() {
  const srcBuffer = await extractEmbeddedPngBuffer();
  const srcPng = PNG.sync.read(srcBuffer);

  // Required PWA icon sizes (Chrome + iOS)
  const outputs = [
    { name: 'android-chrome-192x192.png', size: 192 },
    { name: 'android-chrome-512x512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-16x16.png', size: 16 },
  ];

  await Promise.all(
    outputs.map(async ({ name, size }) => {
      const outPng = resizeNearestNeighbor(srcPng, size);
      await writePng(path.join(ASSETS_DIR, name), outPng);
    })
  );

  // We intentionally skip generating a real ICO (requires a dedicated encoder).
  // The app uses PNG favicons instead.
}

await main();

