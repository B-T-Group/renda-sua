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
};

type BusinessInventoryLike = {
  id: string;
  selling_price?: number | null;
  computed_available_quantity?: number | null;
  is_active?: boolean | null;
  business_location?: { name?: string | null } | null;
};

type ItemTagLike = {
  tag?: { name?: string | null } | null;
};

export type BusinessItemLike = {
  id: string;
  name?: string | null;
  description?: string | null;
  price?: number | null;
  brand?: { name?: string | null } | null;
  business?: { name?: string | null } | null;
  item_images?: ItemImageLike[] | null;
  item_tags?: ItemTagLike[] | null;
  business_inventories?: BusinessInventoryLike[] | null;
  /**
   * Google / Facebook product category FKs and joined taxonomy rows live on
   * `item_sub_category`. CSV export uses the FK ids first, then path fallbacks.
   */
  item_sub_category?: {
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
  } | null;
};

/**
 * `google_product_category` column: prefer `item_sub_category.google_product_category`
 * (Google taxonomy id); if unset, use official path from `google_product_category_row`.
 */
function googleProductCategoryForExport(
  sub: BusinessItemLike['item_sub_category'] | null | undefined
): string {
  if (!sub) {
    return '';
  }
  if (sub.google_product_category != null) {
    return String(sub.google_product_category);
  }
  const row = sub.google_product_category_row;
  const a = row?.name_en?.trim();
  if (a) {
    return a;
  }
  const b = row?.name_fr?.trim();
  if (b) {
    return b;
  }
  return '';
}

/**
 * `fb_product_category` column: prefer `item_sub_category.fb_product_category`
 * (Meta category id); if unset, use path from `fb_product_category_row` (locale-aware), then
 * the other language.
 */
function fbProductCategoryForExport(
  sub: BusinessItemLike['item_sub_category'] | null | undefined,
  language: 'en' | 'fr'
): string {
  if (!sub) {
    return '';
  }
  if (sub.fb_product_category != null) {
    return String(sub.fb_product_category);
  }
  const row = sub.fb_product_category_row;
  const primary = language === 'fr' ? row?.name_fr?.trim() : row?.name_en?.trim();
  if (primary) {
    return primary;
  }
  const secondary = language === 'fr' ? row?.name_en?.trim() : row?.name_fr?.trim();
  if (secondary) {
    return secondary;
  }
  return '';
}

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

export function uniqueLocationNamesForItem(item: BusinessItemLike): string[] {
  const set = new Set<string>();
  for (const inv of item.business_inventories ?? []) {
    const n = inv?.business_location?.name?.trim();
    if (n) {
      set.add(n);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Catalog item tag names (distinct, sorted). */
function itemTagNamesForItem(item: BusinessItemLike): string[] {
  const set = new Set<string>();
  for (const row of item.item_tags ?? []) {
    const n = row?.tag?.name?.trim();
    if (n) {
      set.add(n);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Item tags first, then location names (for Facebook `product_tags` columns). */
export function combinedProductTagLabelsForItem(item: BusinessItemLike): string[] {
  return [...itemTagNamesForItem(item), ...uniqueLocationNamesForItem(item)];
}

/**
 * Distributes individual tag labels across up to `columnCount` columns in order:
 * first tags go to column 0, etc., with counts split as evenly as possible.
 * Each column value is comma-separated tags for that segment.
 */
export function distributeTagsEvenlyAcrossColumns(
  tags: string[],
  columnCount: number
): string[] {
  const result: string[] = Array.from({ length: columnCount }, () => '');
  if (tags.length === 0 || columnCount <= 0) {
    return result;
  }
  const n = tags.length;
  const base = Math.floor(n / columnCount);
  const rem = n % columnCount;
  let idx = 0;
  for (let c = 0; c < columnCount; c++) {
    const size = base + (c < rem ? 1 : 0);
    const slice = tags.slice(idx, idx + size);
    result[c] = slice.join(', ');
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
  opts: {
    quantityToSell: number;
    currencyCode: string;
    productCategoryLanguage: 'en' | 'fr';
  }
): FacebookCatalogRow {
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

  const sub = item.item_sub_category;
  const gPath = googleProductCategoryForExport(sub);
  const fbPath = fbProductCategoryForExport(sub, opts.productCategoryLanguage);

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
    google_product_category: gPath,
    fb_product_category: fbPath,
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
    ...productTagRowFields(combinedProductTagLabelsForItem(item)),
    'style[0]': '',
  };
}

export function buildFacebookCatalogRowsFromBusinessItems(input: {
  items: BusinessItemLike[];
  webOrigin: string;
  quantityToSell?: number;
  currencyCode?: string;
  /** For Facebook's `fb_product_category` path, prefer en or fr from taxonomy `name_en` / `name_fr`. */
  productCategoryLanguage?: 'en' | 'fr';
  /** When set, only include catalog items whose `id` is in this set. */
  itemIds?: Set<string> | null;
}): { headers: readonly FacebookCatalogHeader[]; rows: FacebookCatalogRow[] } {
  const quantityToSell = input.quantityToSell ?? 5;
  const currencyCode = input.currencyCode ?? 'XAF';
  const origin = input.webOrigin?.trim() || '';
  const filter = input.itemIds;
  const productCategoryLanguage = input.productCategoryLanguage ?? 'en';

  const rows: FacebookCatalogRow[] = [];
  for (const item of input.items ?? []) {
    if (filter && !filter.has(item.id)) {
      continue;
    }
    const inventories = item.business_inventories ?? [];
    for (const inv of inventories) {
      if (!inv?.id) continue;
      rows.push(
        buildRow(item, inv, origin, {
          quantityToSell,
          currencyCode,
          productCategoryLanguage,
        })
      );
    }
  }

  return { headers: FACEBOOK_CATALOG_HEADERS, rows };
}

export function buildFacebookCatalogCsvFromBusinessItems(input: {
  items: BusinessItemLike[];
  webOrigin: string;
  quantityToSell?: number;
  currencyCode?: string;
  productCategoryLanguage?: 'en' | 'fr';
  itemIds?: Set<string> | null;
}): { filename: string; csv: string; rowCount: number } {
  const { headers, rows } = buildFacebookCatalogRowsFromBusinessItems(input);

  const headerLine = headers.map(csvEscape).join(',');
  const lines = rows.map((row) =>
    headers.map((h) => csvEscape(row[h])).join(',')
  );
  const csv = [headerLine, ...lines].join('\n');

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const filename = `facebook_catalog_inventory_items_${yyyy}-${mm}-${dd}.csv`;

  return { filename, csv, rowCount: rows.length };
}

