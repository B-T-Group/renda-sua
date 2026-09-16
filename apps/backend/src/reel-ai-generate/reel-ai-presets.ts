export type ReelAiPresetId =
  | 'dynamic'
  | 'premium'
  | 'lifestyle'
  | 'social';

export interface ReelAiPreset {
  id: ReelAiPresetId;
  /** i18n key under business.reels.presets.* */
  labelKey: string;
  defaultLabel: string;
  /** Allow adult people in the generated scene. */
  allowAdult: boolean;
  /** Directional prompt fragment for CREATIVE CONCEPT. */
  direction: string;
}

export const REEL_AI_PRESETS: ReelAiPreset[] = [
  {
    id: 'dynamic',
    labelKey: 'business.reels.presets.dynamic',
    defaultLabel: '🔥 Dynamic',
    allowAdult: false,
    direction:
      'Create an energetic commercial with fast but smooth camera movement, an engaging product reveal, and a strong hero shot at the end.',
  },
  {
    id: 'premium',
    labelKey: 'business.reels.presets.premium',
    defaultLabel: '✨ Premium',
    allowAdult: false,
    direction:
      'Create an elegant premium commercial with cinematic lighting, slow controlled camera movement, refined composition, and a luxurious presentation.',
  },
  {
    id: 'lifestyle',
    labelKey: 'business.reels.presets.lifestyle',
    defaultLabel: '🏠 Lifestyle',
    allowAdult: true,
    direction:
      'Place the product naturally in a realistic lifestyle environment where it would typically be used. Show the product being used naturally and finish with a clear hero shot.',
  },
  {
    id: 'social',
    labelKey: 'business.reels.presets.social',
    defaultLabel: '💥 Social / Viral',
    allowAdult: true,
    direction:
      'Create an attention-grabbing social-media advertisement with an immediate visual hook, dynamic camera movement, visually interesting transitions, and a memorable final product shot.',
  },
];

const LEGACY_PRESET_MAP: Record<string, ReelAiPresetId> = {
  product_centered: 'premium',
  luxury: 'premium',
  fresh: 'premium',
  unboxing: 'premium',
  explosive: 'dynamic',
  exciting: 'dynamic',
  custom: 'dynamic',
  ugc: 'social',
  cozy: 'lifestyle',
  outdoor: 'lifestyle',
};

const PROMPT_MAX_CHARS = 5500;
const DESCRIPTION_MAX_CHARS = 500;

/** Normalize legacy or current preset ids to a selectable preset. */
export function normalizeReelAiPresetId(id: string | null | undefined): ReelAiPresetId {
  const trimmed = id?.trim().toLowerCase() || '';
  if (trimmed === 'dynamic') return 'dynamic';
  if (trimmed === 'premium') return 'premium';
  if (trimmed === 'lifestyle') return 'lifestyle';
  if (trimmed === 'social') return 'social';
  return LEGACY_PRESET_MAP[trimmed] ?? 'dynamic';
}

export function getReelAiPreset(id: string): ReelAiPreset | undefined {
  const normalized = normalizeReelAiPresetId(id);
  return REEL_AI_PRESETS.find((p) => p.id === normalized);
}

/** English display name for ISO-2 market codes used in Veo prompts. */
export function resolveMarketCountryName(
  code: string | null | undefined
): string {
  const iso = code?.trim().toUpperCase();
  if (!iso) return 'Unknown';
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(iso);
    return name || iso;
  } catch {
    return iso;
  }
}

export function buildVeoReelPrompt(params: {
  presetId: string;
  userPrompt?: string | null;
  productName: string;
  productDescription?: string | null;
  brand?: string | null;
  marketCountry?: string | null;
}): string {
  const preset = getReelAiPreset(params.presetId);
  const countryName = resolveMarketCountryName(params.marketCountry);
  const merchantDirection = params.userPrompt?.trim() || '';
  const creativeConcept = [preset?.direction, merchantDirection]
    .filter(Boolean)
    .join('\n');

  const productLines = [
    `Name: ${params.productName}`,
    params.brand ? `Brand: ${params.brand}` : null,
    params.productDescription
      ? `Description: ${params.productDescription.slice(0, DESCRIPTION_MAX_CHARS)}`
      : null,
    `Market country: ${countryName}`,
  ]
    .filter(Boolean)
    .join('\n');

  return [
    'Create a professional 8-second vertical 9:16 ecommerce advertisement for the following product.',
    '',
    'PRODUCT',
    productLines,
    '',
    'CREATIVE CONCEPT',
    creativeConcept,
    '',
    'MARKET FIT',
    `Set the scene, people (when relevant), environment, and cultural cues so they feel natural for ${countryName}. Prefer locally plausible lifestyle contexts over generic Western stock aesthetics. Do not invent prices, currency amounts, or on-screen text.`,
    '',
    'PRODUCT ACCURACY',
    'The reference image is the authoritative representation of the product. Preserve the product exactly as shown, including its shape, proportions, color, materials, texture, packaging, branding, logos, labels, and distinctive physical details.',
    '',
    'The product must remain recognizable and consistent from beginning to end. Never redesign, morph, duplicate, replace, or invent the product. Do not introduce additional versions of the product.',
    '',
    'STORY',
    'Create a visually engaging sequence with:',
    '1. An immediate visual hook.',
    '2. A clear product reveal.',
    '3. An appropriate lifestyle or usage moment when relevant.',
    '4. A clean final hero shot emphasizing the product.',
    '',
    'VISUAL STYLE',
    'Realistic commercial photography, natural lighting, realistic materials, polished composition, smooth cinematic camera movement, and premium ecommerce advertising quality.',
    '',
    'RESTRICTIONS',
    'No fake logos, altered branding, distorted labels, watermarks, captions, subtitles, prices, URLs, phone numbers, or other generated on-screen text.',
    'No unrelated products or objects.',
    'Do not obscure the product.',
    'Avoid duplicated products, product deformation, unrealistic physics, or unnatural interactions.',
    '',
    'OUTPUT',
    '8 seconds, vertical 9:16, optimized for social media.',
  ]
    .join('\n')
    .slice(0, PROMPT_MAX_CHARS);
}
