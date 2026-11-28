import i18next from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import en from './locales/en.json';
import fr from './locales/fr.json';
import { formatMarketCountExact } from '../utils/formatMarketCount';

/** Mobile i18next runs with compatibilityJSON 'v3': plurals are `key` + `key_plural`. */
const i18n = i18next.createInstance();

beforeAll(async () => {
  await i18n.init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    lng: 'en',
    fallbackLng: 'fr',
    compatibilityJSON: 'v3',
    interpolation: { escapeValue: false },
  });
});

const a11y = (lng: 'en' | 'fr', kind: 'rentals' | 'exports' | 'items', count: number) =>
  i18n.getFixedT(lng)(`market.picker.a11y.${kind}`, {
    count,
    formatted: formatMarketCountExact(count, lng),
  }) as string;

describe('market picker copy (mobile, v3 JSON)', () => {
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
  });

  it('uses "Tout le pays" in FR and keeps "All of {{name}}" in EN', () => {
    const t = (lng: 'en' | 'fr') => i18n.getFixedT(lng)('market.picker.allStates', { name: 'Cameroon' }) as string;
    expect(t('en')).toBe('All of Cameroon');
    expect(t('fr')).toBe('Tout le pays');
  });

  it('labels the strip cells with the lane tab labels', () => {
    const lane = (lng: 'en' | 'fr', k: string) => i18n.getFixedT(lng)(`client.home.lane.${k}`) as string;
    expect([lane('en', 'rentals'), lane('en', 'exports'), lane('en', 'shop')]).toEqual(['Rentals', 'Exports', 'Shop']);
    expect([lane('fr', 'rentals'), lane('fr', 'exports'), lane('fr', 'shop')]).toEqual(['Locations', 'Export', 'Boutique']);
  });
});
