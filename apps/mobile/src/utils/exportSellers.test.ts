import i18next from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import en from '../i18n/locales/en.json';
import fr from '../i18n/locales/fr.json';
import { exportSellersPath } from '../services/inventoryItemsApi';
import { exportsSummaryLine } from './exportSellers';
import { EXPORT_SELLER_TINTS, exportSellerMonogram, exportSellerTint } from './exportSellers';

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

  it('uses Sellers / Vendeurs, never Brands / Marques', () => {
    const flat = JSON.stringify([(en as never)['exportSellers'], (fr as never)['exportSellers']]);
    expect(flat).not.toMatch(/brand|marque/i);
    expect(Object.keys((en as never)['exportSellers']).filter((k) => /_(one|other)$/.test(k))).toEqual([]);
  });
});
