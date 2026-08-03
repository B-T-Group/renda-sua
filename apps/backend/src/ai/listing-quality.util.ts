export type FieldConfidence = 'high' | 'medium' | 'low';

export interface ListingQualityInput {
  photoCount: number;
  averageImageQuality?: number | null;
  name?: string | null;
  description?: string | null;
  categoryName?: string | null;
  brandName?: string | null;
  hasWeightOrDimensions?: boolean;
  hasBarcode?: boolean;
}

export interface ListingQualityResult {
  score: number;
  label: 'poor' | 'fair' | 'good' | 'great';
  suggestedAction: string | null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function computeListingQuality(
  input: ListingQualityInput
): ListingQualityResult {
  const photoQuality = clamp(input.averageImageQuality ?? 70, 0, 100);
  const photoQualityPts = (photoQuality / 100) * 40;

  let photoCountPts = 8;
  if (input.photoCount >= 4) photoCountPts = 15;
  else if (input.photoCount >= 2) photoCountPts = 12;
  else if (input.photoCount >= 1) photoCountPts = 8;

  const name = (input.name ?? '').trim();
  let titlePts = 0;
  if (name.length >= 4) titlePts += 8;
  if (name.length >= 12) titlePts += 4;
  if (input.brandName?.trim()) titlePts += 3;
  titlePts = Math.min(15, titlePts);

  const desc = (input.description ?? '').trim();
  let descPts = 0;
  if (desc.length >= 20) descPts = 8;
  if (desc.length >= 80) descPts = 15;

  let taxonomyPts = 0;
  if (input.categoryName?.trim()) taxonomyPts += 6;
  if (input.brandName?.trim()) taxonomyPts += 4;

  let attrPts = 0;
  if (input.hasWeightOrDimensions) attrPts += 3;
  if (input.hasBarcode) attrPts += 2;

  const score = Math.round(
    clamp(
      photoQualityPts +
        photoCountPts +
        titlePts +
        descPts +
        taxonomyPts +
        attrPts,
      0,
      100
    )
  );

  let label: ListingQualityResult['label'] = 'poor';
  if (score >= 85) label = 'great';
  else if (score >= 70) label = 'good';
  else if (score >= 50) label = 'fair';

  const suggestedAction = pickSuggestedAction(input, score);
  return { score, label, suggestedAction };
}

function pickSuggestedAction(
  input: ListingQualityInput,
  score: number
): string | null {
  if (score >= 85) return null;
  if (input.photoCount < 2) return 'add_second_photo';
  if (!(input.description ?? '').trim() || (input.description ?? '').length < 40)
    return 'improve_description';
  if (!input.brandName?.trim()) return 'add_brand';
  if (!input.hasWeightOrDimensions) return 'add_attributes';
  return 'add_photo';
}

export function inferFieldConfidence(value: unknown): FieldConfidence {
  if (value == null) return 'low';
  if (typeof value === 'string' && !value.trim()) return 'low';
  if (typeof value === 'number' && Number.isNaN(value)) return 'low';
  return 'medium';
}

/** Simple case-insensitive name similarity for duplicate detection (0–1). */
export function nameSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/([0-9])([a-z])/g, '$1 $2')
      .replace(/([a-z])([0-9])/g, '$1 $2')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const ta = new Set(na.split(' ').filter(Boolean));
  const tb = new Set(nb.split(' ').filter(Boolean));
  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap++;
  }
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : overlap / union;
}
