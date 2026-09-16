export type ReelAiPresetId =
  | 'product_centered'
  | 'explosive'
  | 'exciting'
  | 'luxury'
  | 'fresh'
  | 'unboxing'
  | 'ugc'
  | 'cozy'
  | 'outdoor'
  | 'custom';

export interface ReelAiPreset {
  id: ReelAiPresetId;
  /** i18n key under business.reels.presets.* */
  labelKey: string;
  defaultLabel: string;
  /** Allow adult people in the generated scene. */
  allowAdult: boolean;
  /** Directional prompt fragment; empty for custom. */
  direction: string;
}

export const REEL_AI_PRESETS: ReelAiPreset[] = [
  {
    id: 'product_centered',
    labelKey: 'business.reels.presets.productCentered',
    defaultLabel: 'Product centered',
    allowAdult: false,
    direction:
      'Clean studio product ad, product fills the frame, slow orbit camera, no people, labels stay readable',
  },
  {
    id: 'explosive',
    labelKey: 'business.reels.presets.explosive',
    defaultLabel: 'Explosive',
    allowAdult: false,
    direction:
      'High-energy product ad with fast push-in, bold lighting, particle energy accents, product stays accurate',
  },
  {
    id: 'exciting',
    labelKey: 'business.reels.presets.exciting',
    defaultLabel: 'Exciting',
    allowAdult: true,
    direction:
      'Dynamic lifestyle product ad, upbeat motion, product remains the hero in every shot',
  },
  {
    id: 'luxury',
    labelKey: 'business.reels.presets.luxury',
    defaultLabel: 'Luxury',
    allowAdult: false,
    direction:
      'Dark cinematic lighting, slow dolly, premium materials emphasis, no fake logos',
  },
  {
    id: 'fresh',
    labelKey: 'business.reels.presets.fresh',
    defaultLabel: 'Fresh and bright',
    allowAdult: false,
    direction:
      'Natural daylight, airy and bright, honest product color, subtle dew or steam only if food-related',
  },
  {
    id: 'unboxing',
    labelKey: 'business.reels.presets.unboxing',
    defaultLabel: 'Reveal',
    allowAdult: false,
    direction:
      'Pack peel or lid lift reveal into a still hero close-up of the product',
  },
  {
    id: 'ugc',
    labelKey: 'business.reels.presets.ugc',
    defaultLabel: 'Handheld UGC',
    allowAdult: true,
    direction:
      'Casual handheld phone energy, slight natural shake, authentic feel, product stays centered',
  },
  {
    id: 'cozy',
    labelKey: 'business.reels.presets.cozy',
    defaultLabel: 'Cozy',
    allowAdult: true,
    direction: 'Warm indoor scene, soft lamp light, slow pan around the product',
  },
  {
    id: 'outdoor',
    labelKey: 'business.reels.presets.outdoor',
    defaultLabel: 'Outdoor',
    allowAdult: true,
    direction:
      'Daylight outdoor setting, gentle motion around the product, no extra products',
  },
  {
    id: 'custom',
    labelKey: 'business.reels.presets.custom',
    defaultLabel: 'Custom',
    allowAdult: false,
    direction: '',
  },
];

export function getReelAiPreset(id: string): ReelAiPreset | undefined {
  return REEL_AI_PRESETS.find((p) => p.id === id);
}

export function buildVeoReelPrompt(params: {
  presetId: string;
  userPrompt?: string | null;
  productName: string;
  productDescription?: string | null;
  brand?: string | null;
}): string {
  const preset = getReelAiPreset(params.presetId);
  const direction =
    params.presetId === 'custom'
      ? (params.userPrompt || '').trim()
      : [preset?.direction, params.userPrompt?.trim()].filter(Boolean).join('. ');

  const productBits = [
    params.productName,
    params.brand ? `Brand: ${params.brand}` : null,
    params.productDescription?.slice(0, 400) || null,
  ]
    .filter(Boolean)
    .join('. ');

  const constraint =
    'Keep the product identical to the reference photo. No extra products, no invented logos, no on-screen prices, URLs, or phone numbers. Vertical 9:16 product ad, 8 seconds.';

  return [`Product: ${productBits}`, direction, constraint]
    .filter(Boolean)
    .join('\n')
    .slice(0, 3500);
}
