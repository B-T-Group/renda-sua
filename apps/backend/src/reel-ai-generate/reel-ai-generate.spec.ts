import {
  buildVeoReelPrompt,
  getReelAiPreset,
  normalizeReelAiPresetId,
  resolveMarketCountryName,
  REEL_AI_PRESETS,
} from './reel-ai-presets';
import {
  parseVeoReelTier,
  resolveVeoPersonGeneration,
  resolveVeoReelModel,
  VEO_REEL_MODEL_BY_TIER,
} from './veo-reel-model.util';

describe('veo-reel-model.util', () => {
  it('maps fast and standard tiers; lite maps to fast', () => {
    expect(parseVeoReelTier('FAST')).toBe('fast');
    expect(parseVeoReelTier('standard')).toBe('standard');
    expect(parseVeoReelTier(undefined)).toBe('fast');
    expect(parseVeoReelTier('lite')).toBe('fast');
    expect(resolveVeoReelModel({ envTier: 'lite' })).toBe(
      VEO_REEL_MODEL_BY_TIER.fast
    );
    expect(resolveVeoReelModel({ tierOverride: 'fast' })).toBe(
      VEO_REEL_MODEL_BY_TIER.fast
    );
    expect(resolveVeoReelModel({ tierOverride: 'standard' })).toBe(
      VEO_REEL_MODEL_BY_TIER.standard
    );
    expect(
      resolveVeoReelModel({
        modelOverride: 'custom-model',
        tierOverride: 'fast',
      })
    ).toBe('custom-model');
  });

  it('prefers DB tier override over env tier', () => {
    expect(
      resolveVeoReelModel({ envTier: 'standard', tierOverride: 'fast' })
    ).toBe(VEO_REEL_MODEL_BY_TIER.fast);
  });

  it('uses allow_adult for Veo 3.1 image-to-video', () => {
    expect(
      resolveVeoPersonGeneration(VEO_REEL_MODEL_BY_TIER.fast)
    ).toBe('allow_adult');
    expect(
      resolveVeoPersonGeneration(VEO_REEL_MODEL_BY_TIER.standard)
    ).toBe('allow_adult');
    expect(resolveVeoPersonGeneration('veo-2.0-generate-001')).toBe(
      'dont_allow'
    );
  });
});

describe('reel-ai-presets', () => {
  it('exposes four selectable presets', () => {
    expect(REEL_AI_PRESETS.map((p) => p.id)).toEqual([
      'dynamic',
      'premium',
      'lifestyle',
      'social',
    ]);
  });

  it('maps legacy preset ids', () => {
    expect(normalizeReelAiPresetId('luxury')).toBe('premium');
    expect(normalizeReelAiPresetId('explosive')).toBe('dynamic');
    expect(normalizeReelAiPresetId('ugc')).toBe('social');
    expect(normalizeReelAiPresetId('cozy')).toBe('lifestyle');
    expect(normalizeReelAiPresetId('custom')).toBe('dynamic');
    expect(getReelAiPreset('luxury')?.id).toBe('premium');
  });

  it('sets personGeneration allowAdult per preset', () => {
    expect(getReelAiPreset('dynamic')?.allowAdult).toBe(false);
    expect(getReelAiPreset('premium')?.allowAdult).toBe(false);
    expect(getReelAiPreset('lifestyle')?.allowAdult).toBe(true);
    expect(getReelAiPreset('social')?.allowAdult).toBe(true);
  });

  it('builds a structured Veo prompt with market fit', () => {
    const prompt = buildVeoReelPrompt({
      presetId: 'premium',
      userPrompt: 'slow orbit',
      productName: 'Soap',
      productDescription: 'Handmade',
      brand: 'Acme',
      marketCountry: 'CM',
    });
    expect(prompt).toContain('PRODUCT');
    expect(prompt).toContain('Name: Soap');
    expect(prompt).toContain('Brand: Acme');
    expect(prompt).toContain('CREATIVE CONCEPT');
    expect(prompt).toContain('slow orbit');
    expect(prompt).toContain('MARKET FIT');
    expect(prompt).toContain(resolveMarketCountryName('CM'));
    expect(prompt).toContain('PRODUCT ACCURACY');
    expect(prompt).toContain('OUTPUT');
    expect(prompt).toContain('authoritative representation of the product');
  });

  it('uses merchant direction with dynamic when legacy custom is mapped', () => {
    const prompt = buildVeoReelPrompt({
      presetId: 'custom',
      userPrompt: 'soft steam rising',
      productName: 'Tea',
      marketCountry: 'CA',
    });
    expect(prompt).toContain('soft steam rising');
    expect(prompt).toContain(resolveMarketCountryName('CA'));
  });
});
