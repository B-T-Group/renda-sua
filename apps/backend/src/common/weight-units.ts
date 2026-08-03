/** Matches Postgres `weight_units_enum`: ('g', 'kg', 'lb', 'oz'). */
export const WEIGHT_UNITS = ['g', 'kg', 'lb', 'oz'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

const ALIASES: Record<string, WeightUnit> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  kilo: 'kg',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
};

/** Normalize free-form units (e.g. "Kg") to a DB enum value, or null if empty/unknown. */
export function normalizeWeightUnit(
  value: string | null | undefined
): WeightUnit | null {
  if (value == null) return null;
  const key = value.trim().toLowerCase();
  if (!key) return null;
  return ALIASES[key] ?? null;
}

export function isWeightUnit(value: string): value is WeightUnit {
  return (WEIGHT_UNITS as readonly string[]).includes(value);
}
