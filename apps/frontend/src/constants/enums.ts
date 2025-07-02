// Size units enum matching the database size_units_enum
export const SIZE_UNITS = ['cm', 'm', 'inch', 'ft', 'mm'] as const;
export type SizeUnit = (typeof SIZE_UNITS)[number];

// Weight units enum matching the database weight_units_enum
export const WEIGHT_UNITS = ['g', 'kg', 'lb', 'oz'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

// Currency options
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'XAF'] as const;
export type Currency = (typeof CURRENCIES)[number];
