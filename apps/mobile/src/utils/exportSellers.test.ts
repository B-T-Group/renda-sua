import i18next from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import en from '../i18n/locales/en.json';
import fr from '../i18n/locales/fr.json';
import { exportSellersPath } from '../services/inventoryItemsApi';
import {
  EXPORT_SELLER_TINTS,
  exportSellerMonogram,
  exportSellerTint,
  exportsSummaryLine,
  parseExportSellersPage,
} from './exportSellers';

const i18n = i18next.createInstance();
beforeAll(async () => {
  await i18n.init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    lng: 'en',
    compatibilityJSON: 'v3',
    interpolation: { escapeValue: false },
  });
});
const tr = (lng: 'en' | 'fr') => i18n.getFixedT(lng) as never;

describe('exportSellersPath', () => {
  it('From uses origin_country; Into uses country_code; always export_only', () => {
    expect(exportSellersPath({ direction: 'from', marketCode: 'CM', originCode: 'ca', limit: 10 })).toBe(
      '/inventory-items/stores?export_only=true&limit=10&origin_country=CA'
    );
    expect(exportSellersPath({ direction: 'into', marketCode: 'cm', originCode: 'CA', search: ' maple ', offset: 30, limit: 30 })).toBe(
      '/inventory-items/stores?export_only=true&limit=30&offset=30&country_code=CM&search=maple'
    );
    expect(exportSellersPath({ direction: 'from', originCode: 'CA', businessLocationId: 'loc-1', limit: 1 })).toContain(
      'business_location_id=loc-1'
    );
  });
});

describe('seller monogram', () => {
  it('never uses the purple swatch and uses two letters for multi-word names', () => {
    expect(EXPORT_SELLER_TINTS).not.toContain('#6A4C93');
    for (const n of ['Hudson Bay Outfitters', 'Maple', 'Coopérative agricole du Bas-Saint-Laurent', 'x']) {
      expect(EXPORT_SELLER_TINTS).toContain(exportSellerTint(n));
    }
    expect(exportSellerMonogram('Hudson Bay Outfitters')).toBe('HB');
    expect(exportSellerMonogram('Maple')).toBe('M');
  });
});

describe('seller copy (mobile v3 plurals)', () => {
  it('counts are plural-safe in EN and FR', () => {
    const t = (lng: 'en' | 'fr', key: string, count: number) =>
      i18n.getFixedT(lng)(`exportSellers.${key}`, { count }) as string;
    expect(t('en', 'itemsCount', 1)).toBe('1 item');
    expect(t('en', 'itemsCount', 14)).toBe('14 items');
    expect(t('fr', 'itemsCount', 1)).toBe('1 article');
    expect(t('fr', 'itemsCount', 14)).toBe('14 articles');
    expect(t('en', 'exportItemsCount', 1)).toBe('1 export item');
    expect(t('fr', 'exportItemsCount', 14)).toBe('14 articles d’export');
    expect(t('fr', 'sellersCount', 12)).toBe('12 vendeurs');
    expect(t('fr', 'sellersCount', 1)).toBe('1 vendeur');
  });

  it('one-line counts match the locked copy', () => {
    expect(exportsSummaryLine(tr('en'), 71, 12, 7)).toBe('71 products · 12 sellers · ships to 7 markets');
    expect(exportsSummaryLine(tr('fr'), 71, 12, 7)).toBe('71 produits · 12 vendeurs · expédiés vers 7 marchés');
    expect(exportsSummaryLine(tr('fr'), 1, 1)).toBe('1 produit · 1 vendeur');
  });

  it('pluralizes markets: never "1 markets" (also while sellers load)', () => {
    expect(exportsSummaryLine(tr('en'), 3, 2, 1)).toBe('3 products · 2 sellers · ships to 1 market');
    expect(exportsSummaryLine(tr('fr'), 3, 2, 1)).toBe('3 produits · 2 vendeurs · expédiés vers 1 marché');
    expect(exportsSummaryLine(tr('en'), 1, null, 1)).toBe('1 product · ships to 1 market');
    expect(exportsSummaryLine(tr('fr'), 1, null, 1)).toBe('1 produit · expédié vers 1 marché');
    expect(exportsSummaryLine(tr('en'), 71, null, 7)).toBe('71 products · ships to 7 markets');
  });

  it('uses Sellers / Vendeurs, never Brands / Marques', () => {
    const flat = JSON.stringify([(en as never)['exportSellers'], (fr as never)['exportSellers']]);
    expect(flat).not.toMatch(/brand|marque/i);
    expect(Object.keys((en as never)['exportSellers']).filter((k) => /_(one|other)$/.test(k))).toEqual([]);
  });
});

const intoCm = { direction: 'into' as const, marketCode: 'CM', originCode: null };
const fromCa = { direction: 'from' as const, marketCode: 'CM', originCode: 'CA' };
const caSeller = { business_location_id: 'ca-1', name: 'Rendasua Canada - 1TRACK', country: 'CA', city: 'London', item_count: 2 };
const cmSeller = { business_location_id: 'cm-1', name: 'Happy store - Yaoundé', city: 'Yaoundé', item_count: 12 };

describe('parseExportSellersPage (carousel, count, and See all share this)', () => {
  it('rejects the legacy local directory (stores without total) used for market CM', () => {
    const page = parseExportSellersPage(
      { success: true, data: { stores: [cmSeller, { name: 'Home cake - Douala', city: 'Douala' }, { name: 'MM Rail - Yaoundé', city: 'Yaoundé' }] } },
      intoCm
    );
    expect(page).toEqual({ stores: [], total: 0, country: null });
  });

  it('accepts origin-country sellers for Into Cameroon and never includes destination stores', () => {
    const page = parseExportSellersPage(
      { success: true, data: { stores: [caSeller], total: 9, country: 'CM' } },
      intoCm
    );
    expect(page.total).toBe(9);
    expect(page.stores).toEqual([caSeller]);
    expect(page.stores.every((s) => s.country !== 'CM')).toBe(true);
  });

  it('rejects an Into payload that includes any destination-country seller', () => {
    const page = parseExportSellersPage(
      { success: true, data: { stores: [caSeller, { ...cmSeller, country: 'CM' }], total: 2, country: 'CM' } },
      intoCm
    );
    expect(page).toEqual({ stores: [], total: 0, country: null });
  });

  it('From keeps only sellers in the origin country', () => {
    const ok = parseExportSellersPage(
      { success: true, data: { stores: [caSeller], total: 1, country: 'CA' } },
      fromCa
    );
    expect(ok.stores).toEqual([caSeller]);
    const leak = parseExportSellersPage(
      { success: true, data: { stores: [caSeller, { ...cmSeller, country: 'CM' }], total: 2, country: 'CA' } },
      fromCa
    );
    expect(leak).toEqual({ stores: [], total: 0, country: null });
  });
});
