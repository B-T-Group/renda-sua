export const VEO_REEL_TIER_CONFIG_KEY = 'veo_reel_tier';

export type VeoReelTier = 'fast' | 'standard';

export const VEO_REEL_MODEL_BY_TIER: Record<VeoReelTier, string> = {
  fast: 'veo-3.1-fast-generate-preview',
  standard: 'veo-3.1-generate-preview',
};

export const DEFAULT_VEO_REEL_TIER: VeoReelTier = 'fast';

/**
 * Accepts only fast/standard. Unknown values (including legacy "lite") map to fast.
 */
export function parseVeoReelTier(
  value: string | null | undefined
): VeoReelTier {
  const trimmed = value?.trim().toLowerCase();
  if (trimmed === 'fast') return 'fast';
  if (trimmed === 'standard') return 'standard';
  return DEFAULT_VEO_REEL_TIER;
}

/**
 * Resolve the Gemini Veo model id.
 * Precedence: explicit model override > tier (request/DB/env) > fast default.
 */
export function resolveVeoReelModel(params: {
  modelOverride?: string | null;
  tierOverride?: string | null;
  envTier?: string | null;
}): string {
  const model = params.modelOverride?.trim();
  if (model) return model;
  const tier = parseVeoReelTier(params.tierOverride ?? params.envTier);
  return VEO_REEL_MODEL_BY_TIER[tier];
}

/**
 * Veo 3 / 3.1 image-to-video only accepts `allow_adult`.
 * `dont_allow` is Veo 2-only and Google returns HTTP 400 on 3.1.
 */
export function resolveVeoPersonGeneration(
  model: string
): 'allow_adult' | 'dont_allow' {
  if (/veo-3/i.test(model)) return 'allow_adult';
  return 'dont_allow';
}
