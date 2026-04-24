/**
 * Meta Pixel / catalog alignment for `content_category` and `google_product_category`
 * (same shape as optional catalog fields; see Meta product data spec).
 * https://www.facebook.com/business/help/120325381656392?id=725943027795860
 */
type ItemSubCategoryForMetaPixel = {
  fb_product_category?: number | null;
  fb_product_category_row?: {
    name_en?: string | null;
    name_fr?: string | null;
  } | null;
  google_product_category?: string | number | null;
  google_product_category_row?: {
    name_en?: string | null;
    name_fr?: string | null;
  } | null;
} | null;

type ItemWithSubCategory = {
  item_sub_category?: ItemSubCategoryForMetaPixel;
} | null;

/**
 * `content_category` / `fb_product_category`: Meta taxonomy id or full path
 * (English path, then French, per official lists).
 */
export function metaPixelContentCategoryFromItem(
  item: ItemWithSubCategory | undefined
): string | undefined {
  const sub = item?.item_sub_category;
  if (!sub) return undefined;
  if (sub.fb_product_category != null) {
    return String(sub.fb_product_category);
  }
  const row = sub.fb_product_category_row;
  const fromUSList = row?.name_en?.trim();
  if (fromUSList) return fromUSList;
  const fromFr = row?.name_fr?.trim();
  if (fromFr) return fromFr;
  return undefined;
}

/**
 * `google_product_category`: Google taxonomy id or path
 * (same rules as `googleProductCategoryForExport` in `facebookCatalogCsv.ts`).
 */
export function metaPixelGoogleProductCategoryFromItem(
  item: ItemWithSubCategory | undefined
): string | undefined {
  const sub = item?.item_sub_category;
  if (!sub) return undefined;
  if (sub.google_product_category != null) {
    return String(sub.google_product_category);
  }
  const row = sub.google_product_category_row;
  const a = row?.name_en?.trim();
  if (a) return a;
  const b = row?.name_fr?.trim();
  if (b) return b;
  return undefined;
}
