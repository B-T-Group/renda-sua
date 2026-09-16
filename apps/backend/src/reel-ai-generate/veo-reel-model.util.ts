export const VEO_REEL_TIER_CONFIG_KEY = 'veo_reel_tier';

export type VeoReelTier = 'lite' | 'fast';

export const VEO_REEL_MODEL_BY_TIER: Record<VeoReelTier, string> = {
  lite: 'veo-3.1-lite-generate-preview',
  fast: 'veo-3.1-fast-generate-preview',
};

export const DEFAULT_VEO_REEL_TIER: VeoReelTier = 'lite';

export function parseVeoReelTier(
  value: string | null | undefined
): VeoReelTier {
  const trimmed = value?.trim().toLowerCase();
  if (trimmed === 'fast') return 'fast';
  if (trimmed === 'lite') return 'lite';
  return DEFAULT_VEO_REEL_TIER;
}

/**
 * Resolve the Gemini Veo model id.
 * Precedence: explicit model override > tier (DB or env) > lite default.
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
