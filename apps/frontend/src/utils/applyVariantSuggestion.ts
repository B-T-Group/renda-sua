import type { CreateItemVariantPayload } from '../hooks/useItemVariants';

export interface VariantSuggestionData {
  name?: string;
  color?: string;
  sku?: string;
  price?: number;
  currency?: string;
  weight?: number;
  weightUnit?: string;
  dimensions?: string;
}

function pickSuggestedString(
  locked: ReadonlySet<string>,
  key: string,
  current: string | null | undefined,
  suggested?: string
): string | null | undefined {
  if (locked.has(key)) return current;
  const trimmed = suggested?.trim();
  return trimmed || current;
}

function pickSuggestedNumber(
  locked: ReadonlySet<string>,
  key: string,
  current: number | null | undefined,
  suggested?: number
): number | null | undefined {
  if (locked.has(key)) return current;
  return suggested ?? current;
}

export function applySuggestionToForm(
  form: CreateItemVariantPayload,
  suggestion: VariantSuggestionData,
  locked: ReadonlySet<string>
): CreateItemVariantPayload {
  return {
    ...form,
    name:
      pickSuggestedString(locked, 'name', form.name, suggestion.name) ??
      form.name,
    color: pickSuggestedString(locked, 'color', form.color, suggestion.color),
    sku: pickSuggestedString(locked, 'sku', form.sku, suggestion.sku),
    price: pickSuggestedNumber(locked, 'price', form.price, suggestion.price),
    weight: pickSuggestedNumber(locked, 'weight', form.weight, suggestion.weight),
    weight_unit:
      pickSuggestedString(
        locked,
        'weight_unit',
        form.weight_unit,
        suggestion.weightUnit
      ) ?? form.weight_unit,
    dimensions: pickSuggestedString(
      locked,
      'dimensions',
      form.dimensions,
      suggestion.dimensions
    ),
  };
}
