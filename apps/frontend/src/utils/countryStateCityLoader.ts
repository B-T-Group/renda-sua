let loadPromise: Promise<typeof import('country-state-city')> | null = null;

/** Lazy-loads country-state-city once; safe to call from many places. */
export function getCountryStateCity(): Promise<
  typeof import('country-state-city')
> {
  if (!loadPromise) {
    loadPromise = import(
      /* webpackChunkName: "vendor-countries" */
      'country-state-city'
    );
  }
  return loadPromise;
}
