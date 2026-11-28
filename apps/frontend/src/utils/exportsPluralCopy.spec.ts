import i18next from 'i18next';
import en from '../../public/locales/en.json';
import fr from '../../public/locales/fr.json';

/** Web i18next uses the default v4 JSON: plurals are `key_one` / `key_other`. */
const i18n = i18next.createInstance();
const NBSP = '\u00a0';

beforeAll(async () => {
  await i18n.init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    lng: 'en',
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
  });
});

const tr = (lng: 'en' | 'fr', key: string, opts: Record<string, unknown>) =>
  i18n.getFixedT(lng)(key, opts) as string;

describe('exports plural copy (web, v4 JSON)', () => {
  it('cart purge note', () => {
    expect(tr('en', 'exportItem.cartRemoved', { count: 1 })).toBe('1 item was removed: it’s export only.');
    expect(tr('en', 'exportItem.cartRemoved', { count: 2 })).toBe('2 items were removed: they’re export only.');
    expect(tr('fr', 'exportItem.cartRemoved', { count: 1 })).toBe(`1 article retiré${NBSP}: il est réservé à l’export.`);
    expect(tr('fr', 'exportItem.cartRemoved', { count: 2 })).toBe(
      `2 articles retirés${NBSP}: ils sont réservés à l’export.`
    );
  });

  it('page stats and picker counts', () => {
    expect(tr('fr', 'exportsOrigin.statProducts', { count: 71 })).toBe('produits');
    expect(tr('fr', 'exportsOrigin.statBusinesses', { count: 1 })).toBe('entreprise');
    expect(tr('en', 'exportsOrigin.statBusinesses', { count: 1 })).toBe('business');
    expect(tr('fr', 'exportsOrigin.itemsCount', { count: 71 })).toBe('71 articles');
  });

  it('gallery photo badge pluralizes', () => {
    expect(tr('en', 'business.items.cardGalleryPhotosBadge', { count: 1 })).toBe('1 photo');
    expect(tr('en', 'business.items.cardGalleryPhotosBadge', { count: 4 })).toBe('4 photos');
    expect(tr('fr', 'business.items.cardGalleryPhotosBadge', { count: 1 })).toBe('1 photo');
    expect(tr('fr', 'business.items.cardGalleryPhotosBadge', { count: 4 })).toBe('4 photos');
  });
});
