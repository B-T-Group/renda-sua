const FACEBOOK_CATALOG_HEADERS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
  'google_product_category',
  'fb_product_category',
  'quantity_to_sell_on_facebook',
  'sale_price',
  'sale_price_effective_date',
  'item_group_id',
  'gender',
  'color',
  'size',
  'age_group',
  'material',
  'pattern',
  'shipping',
  'shipping_weight',
  'offer_disclaimer',
  'offer_disclaimer_url',
  'video[0].url',
  'video[0].tag[0]',
  'gtin',
  'product_tags[0]',
  'product_tags[1]',
  'style[0]',
] as const;

type FacebookCatalogHeader = (typeof FACEBOOK_CATALOG_HEADERS)[number];

type ItemImageLike = {
  image_url?: string | null;
  image_type?: string | null;
  display_order?: number | null;
};

type BusinessInventoryLike = {
  id: string;
  selling_price?: number | null;
  computed_available_quantity?: number | null;
  is_active?: boolean | null;
};

type BusinessItemLike = {
  id: string;
  name?: string | null;
  description?: string | null;
  price?: number | null;
  brand?: { name?: string | null } | null;
  business?: { name?: string | null } | null;
  item_images?: ItemImageLike[] | null;
  business_inventories?: BusinessInventoryLike[] | null;
};

function csvEscape(value: unknown): string {
  const raw = value == null ? '' : String(value);
  const needsQuotes = /[",\n\r]/.test(raw);
  const escaped = raw.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function toAbsoluteUrl(origin: string, url: string | null | undefined): string {
  const u = url?.trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  const base = origin.replace(/\/$/, '');
  return `${base}${u.startsWith('/') ? '' : '/'}${u}`;
}

function pickMainOrFirstImageUrl(origin: string, images?: ItemImageLike[] | null): string {
  const list = images ?? [];
  if (list.length === 0) return '';
  const sorted = [...list].sort((a, b) => {
    if (a.image_type === 'main') return -1;
    if (b.image_type === 'main') return 1;
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });
  const main = sorted.find((img) => img.image_type === 'main');
  if (main?.image_url) return toAbsoluteUrl(origin, main.image_url);
  for (const img of sorted) {
    if (img.image_url) return toAbsoluteUrl(origin, img.image_url);
  }
  return '';
}

function formatPriceAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const rounded = Math.round(amount * 100) / 100;
  const s = String(rounded);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

function availabilityForInventoryRow(inv: BusinessInventoryLike): 'in stock' | 'out of stock' {
  const active = inv.is_active !== false;
  const qty = inv.computed_available_quantity ?? null;
  if (!active) return 'out of stock';
  if (typeof qty === 'number' && qty <= 0) return 'out of stock';
  return 'in stock';
}

function buildRow(
  item: BusinessItemLike,
  inv: BusinessInventoryLike,
  origin: string,
  opts: { quantityToSell: number; currencyCode: string }
): Record<FacebookCatalogHeader, string> {
  const title = item.name?.trim() ?? '';
  const description = item.description?.trim() ?? '';
  const brand =
    item.brand?.name?.trim() ||
    item.business?.name?.trim() ||
    'Rendasua';
  const img = pickMainOrFirstImageUrl(origin, item.item_images);
  const amount = inv.selling_price ?? item.price ?? 0;
  const price = `${formatPriceAmount(Number(amount))} ${opts.currencyCode}`.trim();
  const linkBase = origin.replace(/\/$/, '');
  const link = `${linkBase}/items/${inv.id}`;

  return {
    id: inv.id,
    title,
    description,
    availability: availabilityForInventoryRow(inv),
    condition: 'new',
    price,
    link,
    image_link: img,
    brand,
    google_product_category: '',
    fb_product_category: '',
    quantity_to_sell_on_facebook: String(opts.quantityToSell),
    sale_price: '',
    sale_price_effective_date: '',
    item_group_id: '',
    gender: '',
    color: '',
    size: '',
    age_group: '',
    material: '',
    pattern: '',
    shipping: '',
    shipping_weight: '',
    offer_disclaimer: '',
    offer_disclaimer_url: '',
    'video[0].url': '',
    'video[0].tag[0]': '',
    gtin: '',
    'product_tags[0]': '',
    'product_tags[1]': '',
    'style[0]': '',
  };
}

export function buildFacebookCatalogCsvFromBusinessItems(input: {
  items: BusinessItemLike[];
  webOrigin: string;
  quantityToSell?: number;
  currencyCode?: string;
}): { filename: string; csv: string; rowCount: number } {
  const quantityToSell = input.quantityToSell ?? 5;
  const currencyCode = input.currencyCode ?? 'XAF';
  const origin = input.webOrigin?.trim() || '';

  const rows: Array<Record<FacebookCatalogHeader, string>> = [];
  for (const item of input.items ?? []) {
    const inventories = item.business_inventories ?? [];
    for (const inv of inventories) {
      if (!inv?.id) continue;
      rows.push(
        buildRow(item, inv, origin, {
          quantityToSell,
          currencyCode,
        })
      );
    }
  }

  const headerLine = FACEBOOK_CATALOG_HEADERS.map(csvEscape).join(',');
  const lines = rows.map((row) =>
    FACEBOOK_CATALOG_HEADERS.map((h) => csvEscape(row[h])).join(',')
  );
  const csv = [headerLine, ...lines].join('\n');

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const filename = `facebook_catalog_inventory_items_${yyyy}-${mm}-${dd}.csv`;

  return { filename, csv, rowCount: rows.length };
}

