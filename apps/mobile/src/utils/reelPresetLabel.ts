/** Maps AI reel preset ids (current + legacy) to i18n label keys / defaults. */
const PRESET_LABELS: Record<string, { key: string; defaultLabel: string }> = {
  dynamic: {
    key: 'business.reels.presets.dynamic',
    defaultLabel: '🔥 Dynamic',
  },
  premium: {
    key: 'business.reels.presets.premium',
    defaultLabel: '✨ Premium',
  },
  lifestyle: {
    key: 'business.reels.presets.lifestyle',
    defaultLabel: '🏠 Lifestyle',
  },
  social: {
    key: 'business.reels.presets.social',
    defaultLabel: '💥 Social / Viral',
  },
  product_centered: {
    key: 'business.reels.presets.premium',
    defaultLabel: '✨ Premium',
  },
  luxury: {
    key: 'business.reels.presets.premium',
    defaultLabel: '✨ Premium',
  },
  fresh: {
    key: 'business.reels.presets.premium',
    defaultLabel: '✨ Premium',
  },
  unboxing: {
    key: 'business.reels.presets.premium',
    defaultLabel: '✨ Premium',
  },
  explosive: {
    key: 'business.reels.presets.dynamic',
    defaultLabel: '🔥 Dynamic',
  },
  exciting: {
    key: 'business.reels.presets.dynamic',
    defaultLabel: '🔥 Dynamic',
  },
  custom: {
    key: 'business.reels.presets.dynamic',
    defaultLabel: '🔥 Dynamic',
  },
  ugc: {
    key: 'business.reels.presets.social',
    defaultLabel: '💥 Social / Viral',
  },
  cozy: {
    key: 'business.reels.presets.lifestyle',
    defaultLabel: '🏠 Lifestyle',
  },
  outdoor: {
    key: 'business.reels.presets.lifestyle',
    defaultLabel: '🏠 Lifestyle',
  },
};

export function resolveReelPresetLabel(
  presetId: string | null | undefined
): { key: string; defaultLabel: string } | null {
  if (!presetId?.trim()) return null;
  return PRESET_LABELS[presetId.trim().toLowerCase()] ?? null;
}
