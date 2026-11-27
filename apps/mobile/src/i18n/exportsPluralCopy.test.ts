import i18next from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import en from './locales/en.json';
import fr from './locales/fr.json';

/**
 * Mobile i18next runs with compatibilityJSON 'v3' (see ./index.ts): plurals must be
 * `key` + `key_plural`. `_one` / `_other` keys are ignored there and FR fell back to EN.
 */
const i18n = i18next.createInstance();
const NBSP = '\u00a0';

beforeAll(async () => {
  await i18n.init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    lng: 'en',
    fallbackLng: 'fr',
    compatibilityJSON: 'v3',
    interpolation: { escapeValue: false },
  });
});

const tr = (lng: 'en' | 'fr', key: string, opts: Record<string, unknown>) =>
  i18n.getFixedT(lng)(key, opts) as string;

describe('exports plural copy (mobile, v3 JSON)', () => {
  it('cart purge note uses the locked count=1 copy and plural forms', () => {
    expect(tr('en', 'exportItem.cartRemoved', { count: 1 })).toBe('1 item was removed: it’s export only.');
    expect(tr('en', 'exportItem.cartRemoved', { count: 2 })).toBe('2 items were removed: they’re export only.');
    expect(tr('fr', 'exportItem.cartRemoved', { count: 1 })).toBe(`1 article retiré${NBSP}: il est réservé à l’export.`);
    expect(tr('fr', 'exportItem.cartRemoved', { count: 2 })).toBe(
      `2 articles retirés${NBSP}: ils sont réservés à l’export.`
    );
  });

  it('lane summary and picker counts are localized in FR', () => {
    expect(tr('fr', 'exportsOrigin.summary', { count: 71, markets: 7 })).toBe('71 produits · expédiés vers 7 marchés');
    expect(tr('en', 'exportsOrigin.summary', { count: 71, markets: 7 })).toBe('71 products · ships to 7 markets');
    expect(tr('fr', 'exportsOrigin.itemsCount', { count: 71 })).toBe('71 articles');
    expect(tr('fr', 'exportsOrigin.itemsCount', { count: 1 })).toBe('1 article');
    expect(tr('en', 'exportsOrigin.itemsCount', { count: 1 })).toBe('1 item');
  });

  it('has no v4 (_one/_other) keys under the new export namespaces', () => {
    for (const locale of [en, fr] as Array<Record<string, Record<string, string>>>) {
      for (const ns of ['exportsOrigin', 'exportItem']) {
        const bad = Object.keys(locale[ns]).filter((k) => /_(one|other)$/.test(k));
        expect(bad).toEqual([]);
      }
    }
  });
});
