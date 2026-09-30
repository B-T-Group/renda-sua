import type { CatalogExperienceContext } from './catalog-experience.types';

export function localizedCopy(
  language: CatalogExperienceContext['language'],
  en: string,
  fr: string
): string {
  return language === 'fr' ? fr : en;
}

export function catalogLocationWhere(
  country?: string,
  state?: string
): Record<string, unknown> {
  const address: Record<string, unknown> = {
    country: country ? { _eq: country } : { _is_null: false },
  };
  if (state) address.state = { _eq: state };
  return {
    is_active: { _eq: true },
    business: { is_storefront_visible: { _eq: true } },
    address,
  };
}
