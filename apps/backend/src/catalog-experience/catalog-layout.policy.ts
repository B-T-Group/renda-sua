import type { CatalogExperienceContext } from './catalog-experience.types';

const COLD_DISCOVERY = [
  'categories',
  'collections',
  'deals',
  'popular',
  'grid',
] as const;

const RETURNING_DISCOVERY = [
  'recently-viewed',
  'categories',
  'deals',
  'collections',
  'grid',
] as const;

const RESULTS = ['grid'] as const;

export function layoutProviderIds(
  context: Pick<CatalogExperienceContext, 'layout' | 'isReturning'>
): readonly string[] {
  if (context.layout === 'results') return RESULTS;
  return context.isReturning ? RETURNING_DISCOVERY : COLD_DISCOVERY;
}

export function isDiscovery(
  context: Pick<CatalogExperienceContext, 'layout'>
): boolean {
  return context.layout === 'discovery';
}
