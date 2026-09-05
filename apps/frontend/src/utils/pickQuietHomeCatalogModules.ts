type CatalogModule = { path: string };

function modulesMatching<T extends CatalogModule>(
  modules: T[],
  match: (path: string) => boolean
): T[] {
  return modules.filter((module) => match(module.path));
}

function fallbackQuietCatalog<T extends CatalogModule>(input: {
  primaryCatalogModules: T[];
  rentalModules: T[];
  isRentalFocused: boolean;
  locations: T[];
}): T[] {
  if (input.isRentalFocused) {
    return [...input.rentalModules.slice(0, 1), ...input.locations];
  }
  return input.primaryCatalogModules.slice(0, 2);
}

/**
 * Quiet-home catalog shortcuts: primary interest first, then the other
 * catalog only when the merchant already has items there.
 */
export function pickQuietHomeCatalogModules<T extends CatalogModule>(input: {
  primaryCatalogModules: T[];
  rentalModules: T[];
  isRentalFocused: boolean;
  itemCount: number;
  rentalItemCount: number;
}): T[] {
  const locations = modulesMatching(input.primaryCatalogModules, (path) =>
    path.includes('location')
  );
  const rentalCatalog = modulesMatching(input.rentalModules, (path) =>
    path.includes('/rentals/catalog')
  );
  const saleItems = modulesMatching(
    input.primaryCatalogModules,
    (path) => path.includes('/business/items') || path === '/business/items'
  );
  const secondaryCount = input.isRentalFocused
    ? input.itemCount
    : input.rentalItemCount;
  const primary = input.isRentalFocused ? rentalCatalog : saleItems;
  const secondary =
    secondaryCount > 0
      ? input.isRentalFocused
        ? saleItems
        : rentalCatalog
      : [];
  const picked = [...primary, ...secondary, ...locations];
  if (picked.length > 0) return picked;
  return fallbackQuietCatalog({ ...input, locations });
}
