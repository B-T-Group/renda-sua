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
    const blob = JSON.stringify([en.exportSellers, fr.exportSellers]).toLowerCase();
    expect(blob).not.toMatch(/brand|marque/);
    // FR typography: curly apostrophe and NBSP before ":".
    expect(JSON.stringify(fr.exportSellers)).not.toContain("'");
    expect(fr.exportSellers.sellerSeoTitle).toContain('\u00a0:');
  });
});
