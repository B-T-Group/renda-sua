import type { InventoryItem } from './inventory-items.service';

const SEO_DESC_MAX = 160;
const DEFAULT_OG_IMAGE = 'https://rendasua.com/og-image.jpg';

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toAbsoluteUrl(origin: string, url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `${origin}${u.startsWith('/') ? '' : '/'}${u}`;
}

function plainDescription(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncateSeoText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function salePriceForShare(inv: InventoryItem): number {
  const hasDeal =
    inv.hasActiveDeal &&
    typeof inv.original_price === 'number' &&
    typeof inv.discounted_price === 'number' &&
    inv.original_price > 0;
  return hasDeal ? inv.discounted_price! : inv.selling_price;
}

function sortItemImagesLikeListing(
  images: InventoryItem['item']['item_images']
): InventoryItem['item']['item_images'] {
  return [...images].sort((a, b) => {
    if (a.image_type === 'main') return -1;
    if (b.image_type === 'main') return 1;
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });
}

function pickOgImage(webAppOrigin: string, inv: InventoryItem): string {
  const images = inv.item.item_images ?? [];
  const sorted = sortItemImagesLikeListing(images);
  const main = sorted.find((img) => img.image_type === 'main');
  if (main) {
    const fromMain = toAbsoluteUrl(webAppOrigin, main.image_url);
    if (fromMain) return fromMain;
  }
  for (const img of sorted) {
    const abs = toAbsoluteUrl(webAppOrigin, img.image_url);
    if (abs) return abs;
  }
  return DEFAULT_OG_IMAGE;
}

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

type EscapedProductShare = {
  canonicalUrl: string;
  t: string;
  d: string;
  c: string;
  img: string;
  priceAmount: string;
  priceCur: string;
  priceLabel: string;
};

function escapedProductShareFields(
  base: string,
  inv: InventoryItem
): EscapedProductShare {
  const canonicalUrl = `${base}/items/${inv.id}`;
  const descSource =
    plainDescription(inv.item.description) || inv.item.brand?.name || 'Rendasua marketplace';
  const price = salePriceForShare(inv);
  return {
    canonicalUrl,
    t: escapeHtml(inv.item.name),
    d: escapeHtml(truncateSeoText(descSource, SEO_DESC_MAX)),
    c: escapeHtml(canonicalUrl),
    img: escapeHtml(pickOgImage(base, inv)),
    priceAmount: escapeHtml(String(price)),
    priceCur: escapeHtml(inv.item.currency || 'USD'),
    priceLabel: escapeHtml(formatPrice(price, inv.item.currency)),
  };
}

function productShareOgBlock(f: EscapedProductShare): string {
  return `<meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, follow" />
    <title>${f.t}</title>
    <meta name="description" content="${f.d}" />
    <link rel="canonical" href="${f.c}" />
    <meta property="og:title" content="${f.t}" />
    <meta property="og:description" content="${f.d}" />
    <meta property="og:image" content="${f.img}" />
    <meta property="og:url" content="${f.c}" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="Rendasua" />
    <meta property="product:price:amount" content="${f.priceAmount}" />
    <meta property="product:price:currency" content="${f.priceCur}" />`;
}

function productShareTwitterAndRedirect(f: EscapedProductShare): string {
  return `<meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${f.t}" />
    <meta name="twitter:description" content="${f.d}" />
    <meta name="twitter:image" content="${f.img}" />
    <meta http-equiv="refresh" content="0;url=${f.c}" />
    <script>window.location.replace(${JSON.stringify(f.canonicalUrl)});</script>`;
}

function productShareHead(f: EscapedProductShare): string {
  return `${productShareOgBlock(f)}
    ${productShareTwitterAndRedirect(f)}`;
}

function productShareBody(f: EscapedProductShare): string {
  return `<p><a href="${f.c}">${f.t}</a> — ${f.priceLabel}</p>`;
}

export function buildInventoryItemShareHtml(
  webAppOrigin: string,
  inv: InventoryItem
): string {
  const base = webAppOrigin.replace(/\/$/, '');
  const f = escapedProductShareFields(base, inv);
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    ${productShareHead(f)}
  </head>
  <body>
    ${productShareBody(f)}
  </body>
</html>`;
}

function notFoundShareHead(catalogUrl: string, t: string, d: string, c: string, img: string): string {
  return `<meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, follow" />
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${c}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:url" content="${c}" />
    <meta property="og:type" content="website" />
    <meta http-equiv="refresh" content="0;url=${c}" />
    <script>window.location.replace(${JSON.stringify(catalogUrl)});</script>`;
}

export function buildInventoryItemNotFoundShareHtml(
  webAppOrigin: string,
  _inventoryId: string
): string {
  const base = webAppOrigin.replace(/\/$/, '');
  const catalogUrl = `${base}/items`;
  const t = escapeHtml('Product | Rendasua');
  const d = escapeHtml('This product is no longer available.');
  const c = escapeHtml(catalogUrl);
  const img = escapeHtml(DEFAULT_OG_IMAGE);
  const head = notFoundShareHead(catalogUrl, t, d, c, img);
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    ${head}
  </head>
  <body>
    <p>${d}</p>
  </body>
</html>`;
}
