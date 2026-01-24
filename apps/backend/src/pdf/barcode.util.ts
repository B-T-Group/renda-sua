// eslint-disable-next-line @typescript-eslint/no-require-imports
const bwipjs = require('bwip-js') as { toBuffer: (opts: object) => Promise<Buffer> };

/**
 * Generate a Code128 barcode for the given text (e.g. order_number) as a base64 data URL
 * for embedding in HTML img src.
 */
export async function generateBarcodeDataUrl(text: string): Promise<string> {
  const buffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 2,
    height: 10,
    includetext: true,
    textxalign: 'center',
  });
  const base64 = buffer.toString('base64');
  return `data:image/png;base64,${base64}`;
}
