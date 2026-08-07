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
  'product_tags[2]',
  'product_tags[3]',
  'product_tags[4]',
  'product_tags[5]',
  'product_tags[6]',
  'product_tags[7]',
  'product_tags[8]',
  'product_tags[9]',
  'style[0]',
] as const;

/** Facebook catalog allows multiple `product_tags[n]` columns; we cap at 10. */
export const FACEBOOK_PRODUCT_TAG_COLUMN_COUNT = 10;

export type FacebookCatalogHeader = (typeof FACEBOOK_CATALOG_HEADERS)[number];
export type FacebookCatalogRow = Record<FacebookCatalogHeader, string>;

type ItemImageLike = {
  image_url?: string | null;
  image_type?: string | null;
  display_order?: number | null;
  display_url?: string | null;
  is_primary?: boolean | null;
};

type ItemTagLike = {
  tag?: { name?: string | null } | null;
};

type ItemSubCategoryLike = {
  google_product_category?: string | number | null;
  fb_product_category?: number | null;
  google_product_category_row?: {
    id?: string | number;
    name_en?: string | null;
    name_fr?: string | null;
  } | null;
  fb_product_category_row?: {
    id?: string | number;
    name_en?: string | null;
    name_fr?: string | null;
  } | null;
};

export type FeedInventoryRow = {
  id: string;
  selling_price?: number | null;
  computed_available_quantity?: number | null;
  is_active?: boolean | null;
  item_variant_id?: string | null;
  business_location?: {
    name?: string | null;
    business?: { name?: string | null } | null;
  } | null;
  item_variant?: {
    item_variant_images?: ItemImageLike[] | null;
  } | null;
  item?: {
    name?: string | null;
    description?: string | null;
    price?: number | null;
    currency?: string | null;
    is_used?: boolean | null;
    brand?: { name?: string | null } | null;
    item_images?: ItemImageLike[] | null;
    item_tags?: ItemTagLike[] | null;
    item_sub_category?: ItemSubCategoryLike | null;
  } | null;
};

function googleProductCategoryForExport(
  sub: ItemSubCategoryLike | null | undefined
): string {
  if (!sub) return '';
  if (sub.google_product_category != null) {
    return String(sub.google_product_category);
  }
  const row = sub.google_product_category_row;
  return row?.name_en?.trim() || row?.name_fr?.trim() || '';
}

function fbProductCategoryForExport(
  sub: ItemSubCategoryLike | null | undefined,
  language: 'en' | 'fr'
): string {
  if (!sub) return '';
  if (sub.fb_product_category != null) {
    return String(sub.fb_product_category);
  }
  const row = sub.fb_product_category_row;
  const primary =
    language === 'fr' ? row?.name_fr?.trim() : row?.name_en?.trim();
  if (primary) return primary;
  return language === 'fr'
    ? row?.name_en?.trim() || ''
    : row?.name_fr?.trim() || '';
}

export function csvEscape(value: unknown): string {
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

/** Full original/primary asset only — never thumbnail or display_url. */
function imageSourceUrl(img: ItemImageLike): string {
  return img.image_url?.trim() || '';
}

function pickMainOrFirstImageUrl(
  origin: string,
  images?: ItemImageLike[] | null
): string {
  const list = images ?? [];
  if (list.length === 0) return '';
  const sorted = [...list].sort((a, b) => {
    if (a.image_type === 'main' || a.is_primary) return -1;
    if (b.image_type === 'main' || b.is_primary) return 1;
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });
  const preferred =
    sorted.find((img) => img.image_type === 'main' || img.is_primary) ??
    sorted[0];
  const url = preferred ? imageSourceUrl(preferred) : '';
  if (url) return toAbsoluteUrl(origin, url);
  for (const img of sorted) {
    const u = imageSourceUrl(img);
    if (u) return toAbsoluteUrl(origin, u);
  }
  return '';
}

/** Prefer variant images when the inventory row is bound to a variant. */
export function pickFeedImageUrl(origin: string, inv: FeedInventoryRow): string {
  const variantImgs = inv.item_variant?.item_variant_images;
  if (variantImgs && variantImgs.length > 0) {
    const fromVariant = pickMainOrFirstImageUrl(origin, variantImgs);
    if (fromVariant) return fromVariant;
  }
  return pickMainOrFirstImageUrl(origin, inv.item?.item_images);
}

function formatPriceAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const rounded = Math.round(amount * 100) / 100;
  const s = String(rounded);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

function itemTagNames(item: FeedInventoryRow['item']): string[] {
  const set = new Set<string>();
  for (const row of item?.item_tags ?? []) {
    const n = row?.tag?.name?.trim();
    if (n) set.add(n);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Item tags first, then location name (for Facebook `product_tags` columns). */
export function combinedProductTagLabels(inv: FeedInventoryRow): string[] {
  const tags = itemTagNames(inv.item);
  const loc = inv.business_location?.name?.trim();
  return loc ? [...tags, loc] : tags;
}

/**
 * Distributes individual tag labels across up to `columnCount` columns in order.
 * Each column value is comma-separated tags for that segment.
 */
export function distributeTagsEvenlyAcrossColumns(
  tags: string[],
  columnCount: number
): string[] {
  const result: string[] = Array.from({ length: columnCount }, () => '');
  if (tags.length === 0 || columnCount <= 0) return result;
  const n = tags.length;
  const base = Math.floor(n / columnCount);
  const rem = n % columnCount;
  let idx = 0;
  for (let c = 0; c < columnCount; c++) {
    const size = base + (c < rem ? 1 : 0);
    result[c] = tags.slice(idx, idx + size).join(', ');
    idx += size;
  }
  return result;
}

type FacebookProductTagKeys =
  | 'product_tags[0]'
  | 'product_tags[1]'
  | 'product_tags[2]'
  | 'product_tags[3]'
  | 'product_tags[4]'
  | 'product_tags[5]'
  | 'product_tags[6]'
  | 'product_tags[7]'
  | 'product_tags[8]'
  | 'product_tags[9]';

const PRODUCT_TAG_KEYS: FacebookProductTagKeys[] = [
  'product_tags[0]',
  'product_tags[1]',
  'product_tags[2]',
  'product_tags[3]',
  'product_tags[4]',
  'product_tags[5]',
  'product_tags[6]',
  'product_tags[7]',
  'product_tags[8]',
  'product_tags[9]',
];

function productTagRowFields(
  tagLabels: string[]
): Pick<FacebookCatalogRow, FacebookProductTagKeys> {
  const values = distributeTagsEvenlyAcrossColumns(
    tagLabels,
    FACEBOOK_PRODUCT_TAG_COLUMN_COUNT
  );
  return PRODUCT_TAG_KEYS.reduce(
    (acc, key, i) => {
      acc[key] = values[i] ?? '';
      return acc;
    },
    {} as Pick<FacebookCatalogRow, FacebookProductTagKeys>
  );
}

export function availabilityForInventoryRow(
  inv: Pick<FeedInventoryRow, 'is_active' | 'computed_available_quantity'>
): 'in stock' | 'out of stock' {
  if (inv.is_active === false) return 'out of stock';
  const qty = inv.computed_available_quantity ?? null;
  if (typeof qty === 'number' && qty <= 0) return 'out of stock';
  return 'in stock';
}

/** Sellable quantity for Facebook; never exceeds computed available stock. */
export function quantityToSellForInventory(
  inv: Pick<FeedInventoryRow, 'is_active' | 'computed_available_quantity'>
): number {
  if (inv.is_active === false) return 0;
  const qty = inv.computed_available_quantity;
  if (typeof qty !== 'number' || !Number.isFinite(qty)) return 0;
  return Math.max(0, Math.floor(qty));
}

export function currencyCodeForInventory(
  inv: FeedInventoryRow,
  fallback = 'XAF'
): string {
  const code = inv.item?.currency?.trim().toUpperCase();
  return code || fallback;
}

function buildRow(
  inv: FeedInventoryRow,
  origin: string,
  opts: {
    defaultCurrencyCode: string;
    productCategoryLanguage: 'en' | 'fr';
  }
): FacebookCatalogRow {
  const item = inv.item;
  const title = item?.name?.trim() ?? '';
  const description = item?.description?.trim() ?? '';
  const brand =
    item?.brand?.name?.trim() ||
    inv.business_location?.business?.name?.trim() ||
    'Rendasua';
  const img = pickFeedImageUrl(origin, inv);
  const amount = inv.selling_price ?? item?.price ?? 0;
  const currency = currencyCodeForInventory(inv, opts.defaultCurrencyCode);
  const price = `${formatPriceAmount(Number(amount))} ${currency}`.trim();
  const link = `${origin.replace(/\/$/, '')}/items/${inv.id}`;
  const sub = item?.item_sub_category;

  return {
    id: inv.id,
    title,
    description,
    availability: availabilityForInventoryRow(inv),
    condition: item?.is_used ? 'used' : 'new',
    price,
    link,
    image_link: img,
    brand,
    google_product_category: googleProductCategoryForExport(sub),
    fb_product_category: fbProductCategoryForExport(
      sub,
      opts.productCategoryLanguage
    ),
    quantity_to_sell_on_facebook: String(quantityToSellForInventory(inv)),
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
    ...productTagRowFields(combinedProductTagLabels(inv)),
    'style[0]': '',
  };
}

export function buildFacebookCatalogRowsFromInventories(input: {
  inventories: FeedInventoryRow[];
  webOrigin: string;
  /** Fallback when `item.currency` is missing. */
  defaultCurrencyCode?: string;
  productCategoryLanguage?: 'en' | 'fr';
}): { headers: readonly FacebookCatalogHeader[]; rows: FacebookCatalogRow[] } {
  const defaultCurrencyCode = input.defaultCurrencyCode ?? 'XAF';
  const origin = input.webOrigin?.trim() || '';
  const productCategoryLanguage = input.productCategoryLanguage ?? 'en';
  const rows: FacebookCatalogRow[] = [];
  for (const inv of input.inventories ?? []) {
    if (!inv?.id) continue;
    rows.push(
      buildRow(inv, origin, {
        defaultCurrencyCode,
        productCategoryLanguage,
      })
    );
  }
  return { headers: FACEBOOK_CATALOG_HEADERS, rows };
}

export function buildFacebookCatalogCsvFromInventories(input: {
  inventories: FeedInventoryRow[];
  webOrigin: string;
  defaultCurrencyCode?: string;
  productCategoryLanguage?: 'en' | 'fr';
}): { csv: string; rowCount: number } {
  const { headers, rows } = buildFacebookCatalogRowsFromInventories(input);
  const headerLine = headers.map(csvEscape).join(',');
  const lines = rows.map((row) =>
    headers.map((h) => csvEscape(row[h])).join(',')
  );
  return { csv: [headerLine, ...lines].join('\n'), rowCount: rows.length };
}
