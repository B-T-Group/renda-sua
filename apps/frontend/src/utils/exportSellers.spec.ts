import i18next from 'i18next';
import en from '../../public/locales/en.json';
import fr from '../../public/locales/fr.json';
import {
  EXPORT_SELLER_TINTS,
  exportSellerCanonicalUrl,
  exportSellerMonogram,
  exportSellerPath,
  exportSellersCanonicalUrl,
  exportSellersListPath,
  exportSellersQueryParams,
  exportSellerTint,
  exportsSummaryLine,
  parseExportSellersPage,
} from './exportSellers';

describe('exportSellers utils', () => {
  it('builds Into and public From paths and canonical URLs on rendasua.com', () => {
    const into = { direction: 'into' as const, marketCode: 'CM', originCode: null };
    const from = { direction: 'from' as const, marketCode: null, originCode: 'CA' };
    expect(exportSellersListPath(into)).toBe('/exports/sellers');
    expect(exportSellerPath(into, 'loc-1')).toBe('/exports/sellers/loc-1');
    expect(exportSellersListPath(from)).toBe('/exports/ca/sellers');
    expect(exportSellerPath(from, 'loc-1')).toBe('/exports/ca/sellers/loc-1');
    expect(exportSellersCanonicalUrl('CA')).toBe('https://rendasua.com/exports/ca/sellers');
    expect(exportSellerCanonicalUrl('CA', 'loc-1')).toBe('https://rendasua.com/exports/ca/sellers/loc-1');
  });

  it('applies Into/From to the stores query (additive export_only params)', () => {
    expect(
      exportSellersQueryParams({ direction: 'from', marketCode: 'CM', originCode: 'ca' }, { limit: 10, search: ' maple ' })
    ).toEqual({ export_only: 'true', limit: 10, origin_country: 'CA', search: 'maple' });
    expect(
      exportSellersQueryParams({ direction: 'into', marketCode: 'cm', originCode: null }, { limit: 20, offset: 20, businessLocationId: 'loc-1' })
    ).toEqual({ export_only: 'true', limit: 20, offset: 20, country_code: 'CM', business_location_id: 'loc-1' });
  });

  it('uses non-purple monogram tints and 1–2 letter monograms', () => {
    expect(EXPORT_SELLER_TINTS.map((c) => c.toUpperCase())).not.toContain('#6A4C93');
    expect(EXPORT_SELLER_TINTS[0]).toBe('#0A4FB5');
    expect(EXPORT_SELLER_TINTS).toContain(exportSellerTint('Nordiqq Outfitters'));
    expect(exportSellerMonogram('Nordiqq Outfitters')).toBe('NO');
    expect(exportSellerMonogram('Kribi')).toBe('K');
    expect(exportSellerMonogram('  ')).toBe('S');
  });

  it('renders EN/FR v4 plurals and the one-line counts, with Sellers/Vendeurs wording only', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng: 'en', resources: { en: { translation: en }, fr: { translation: fr } } });
    const tEn = i18n.getFixedT('en');
    const tFr = i18n.getFixedT('fr');
    expect(tEn('exportSellers.itemsCount', { count: 1 })).toBe('1 item');
    expect(tEn('exportSellers.itemsCount', { count: 5 })).toBe('5 items');
    expect(tFr('exportSellers.itemsCount', { count: 1 })).toBe('1 article');
    expect(tFr('exportSellers.title')).toBe('Vendeurs');
    expect(tEn('exportSellers.title')).toBe('Sellers');
    expect(exportsSummaryLine(tEn as never, 71, 12, 7)).toBe('71 products · 12 sellers · ships to 7 markets');
    expect(exportsSummaryLine(tFr as never, 71, 12, 7)).toBe('71 produits · 12 vendeurs · expédiés vers 7 marchés');
    expect(exportsSummaryLine(tFr as never, 1, 1, 1)).toBe('1 produit · 1 vendeur · expédié vers 1 marché');
    expect(exportsSummaryLine(tEn as never, 3, 1)).toBe('3 products · 1 seller');
    expect(exportsSummaryLine(tEn as never, 3, 2, 1)).toBe('3 products · 2 sellers · ships to 1 market');
    expect(exportsSummaryLine(tFr as never, 3, 2, 1)).toBe('3 produits · 2 vendeurs · expédiés vers 1 marché');
    expect(exportsSummaryLine(tEn as never, 1, null, 1)).toBe('1 product · ships to 1 market');
    const blob = JSON.stringify([en.exportSellers, fr.exportSellers]).toLowerCase();
    expect(blob).not.toMatch(/brand|marque/);
    // FR typography: curly apostrophe and NBSP before ":".
    expect(JSON.stringify(fr.exportSellers)).not.toContain("'");
    expect(fr.exportSellers.sellerSeoTitle).toContain('\u00a0:');
    expect(tEn('exportsOrigin.intoPageTitle', { place: 'Cameroon' })).toBe('Exports into Cameroon');
    expect(tFr('exportsOrigin.intoPageTitle', { place: 'le Cameroun' })).toBe('Exports vers le Cameroun');
    expect(tEn('exportsOrigin.seoDescription', {
      count: 2, place: 'Canada',
      businesses: tEn('exportsOrigin.seoBusinesses', { count: 1 }),
      markets: tEn('exportsOrigin.seoMarkets', { count: 1 }),
    })).toBe('2 products exported from Canada by 1 business to 1 market. Browse and send interest, no account needed.');
    expect(tFr('exportsOrigin.seoDescription', {
      count: 2, place: 'le Canada',
      businesses: tFr('exportsOrigin.seoBusinesses', { count: 1 }),
      markets: tFr('exportsOrigin.seoMarkets', { count: 1 }),
    })).toBe('2 produits exportés depuis le Canada par 1 entreprise vers 1 marché. Parcourez et manifestez votre intérêt, sans compte.');
    expect(tEn('exportsOrigin.seoBusinesses', { count: 2 })).toBe('2 businesses');
    expect(tFr('exportsOrigin.seoBusinesses', { count: 2 })).toBe('2 entreprises');
    expect(tEn('exportsOrigin.seoMarkets', { count: 7 })).toBe('7 markets');
  });
});

const intoCm = { direction: 'into' as const, marketCode: 'CM', originCode: null };
const fromCa = { direction: 'from' as const, marketCode: 'CM', originCode: 'CA' };
const caSeller = { business_location_id: 'ca-1', name: 'Rendasua Canada - 1TRACK', country: 'CA', city: 'London', item_count: 2 };
const cmSeller = { business_location_id: 'cm-1', name: 'Happy store - Yaoundé', city: 'Yaoundé', item_count: 12 };

describe('parseExportSellersPage (carousel, count, and See all share this)', () => {
  it('rejects the legacy local directory (stores without total) used for market CM', () => {
    const page = parseExportSellersPage(
      { success: true, data: { stores: [cmSeller, { name: 'Home cake - Douala', city: 'Douala' }] } },
      intoCm
    );
    expect(page).toEqual({ stores: [], total: 0, country: null });
  });

  it('does not fall back to stores.length when total is missing (avoids counting local stores as sellers)', () => {
    const page = parseExportSellersPage(
      { success: true, data: { stores: [cmSeller, cmSeller, cmSeller] } },
      intoCm
    );
    expect(page.total).toBe(0);
    expect(page.stores).toEqual([]);
  });

  it('accepts origin-country sellers for Into Cameroon', () => {
    const page = parseExportSellersPage(
      { success: true, data: { stores: [caSeller], total: 9, country: 'CM' } },
      intoCm
    );
    expect(page.total).toBe(9);
    expect(page.stores.map((s) => s.country)).toEqual(['CA']);
  });

  it('rejects an Into payload that includes any destination-country seller', () => {
    const page = parseExportSellersPage(
      { success: true, data: { stores: [caSeller, { ...cmSeller, country: 'CM' }], total: 2, country: 'CM' } },
      intoCm
    );
    expect(page).toEqual({ stores: [], total: 0, country: null });
  });

  it('From keeps only sellers in the origin country', () => {
    expect(
      parseExportSellersPage({ success: true, data: { stores: [caSeller], total: 1, country: 'CA' } }, fromCa).stores
    ).toEqual([caSeller]);
    expect(
      parseExportSellersPage(
        { success: true, data: { stores: [caSeller, { ...cmSeller, country: 'CM' }], total: 2, country: 'CA' } },
        fromCa
      )
    ).toEqual({ stores: [], total: 0, country: null });
  });
});
