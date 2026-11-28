import i18next from 'i18next';
import en from '../../../public/locales/en.json';
import fr from '../../../public/locales/fr.json';
import { formatMarketCountExact } from '../../utils/formatMarketCount';

/** Web i18next uses v4 plural keys (`_one` / `_other`, plus `_many` for FR millions). */
const i18n = i18next.createInstance();

beforeAll(async () => {
  await i18n.init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
});

const a11y = (lng: 'en' | 'fr', kind: 'rentals' | 'exports' | 'items', count: number) =>
  i18n.getFixedT(lng)(`market.picker.a11y.${kind}`, {
    count,
    formatted: formatMarketCountExact(count, lng),
  }) as string;

describe('market picker copy (web, v4 plurals)', () => {
  it('reads each count with its unit, plural-aware, in EN', () => {
    expect(a11y('en', 'rentals', 32)).toBe('32 rentals');
    expect(a11y('en', 'rentals', 1)).toBe('1 rental');
    expect(a11y('en', 'exports', 86)).toBe('86 exports');
    expect(a11y('en', 'exports', 1)).toBe('1 export');
    expect(a11y('en', 'items', 1240)).toBe('1,240 items');
    expect(a11y('en', 'items', 1)).toBe('1 item');
  });

  it('reads each count with its unit, plural-aware, in FR', () => {
    expect(a11y('fr', 'rentals', 32)).toBe('32 locations');
    expect(a11y('fr', 'rentals', 1)).toBe('1 location');
    expect(a11y('fr', 'exports', 86)).toBe('86 exports');
    expect(a11y('fr', 'items', 1240)).toBe('1\u202f240 articles');
    expect(a11y('fr', 'items', 1)).toBe('1 article');
    expect(a11y('fr', 'items', 2_000_000)).toBe('2\u202f000\u202f000 articles');
  });

  it('uses "Tout le pays" in FR and keeps "All of {{name}}" in EN', () => {
    const t = (lng: 'en' | 'fr') =>
      i18n.getFixedT(lng)('market.picker.allStates', { name: 'Cameroon' }) as string;
    expect(t('en')).toBe('All of Cameroon');
    expect(t('fr')).toBe('Tout le pays');
  });
});
