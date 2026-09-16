import {
  buildVeoReelPrompt,
  getReelAiPreset,
} from './reel-ai-presets';
import {
  parseVeoReelTier,
  resolveVeoPersonGeneration,
  resolveVeoReelModel,
  VEO_REEL_MODEL_BY_TIER,
} from './veo-reel-model.util';

describe('veo-reel-model.util', () => {
  it('maps lite and fast tiers', () => {
    expect(parseVeoReelTier('FAST')).toBe('fast');
    expect(resolveVeoReelModel({ envTier: 'lite' })).toBe(
      VEO_REEL_MODEL_BY_TIER.lite
    );
    expect(resolveVeoReelModel({ tierOverride: 'fast' })).toBe(
      VEO_REEL_MODEL_BY_TIER.fast
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
      resolveVeoReelModel({ envTier: 'lite', tierOverride: 'fast' })
    ).toBe(VEO_REEL_MODEL_BY_TIER.fast);
  });

  it('uses allow_adult for Veo 3.1 image-to-video', () => {
    expect(
      resolveVeoPersonGeneration(VEO_REEL_MODEL_BY_TIER.lite)
    ).toBe('allow_adult');
    expect(
      resolveVeoPersonGeneration(VEO_REEL_MODEL_BY_TIER.fast)
    ).toBe('allow_adult');
    expect(resolveVeoPersonGeneration('veo-2.0-generate-001')).toBe(
      'dont_allow'
    );
  });
});

describe('reel-ai-presets', () => {
  it('sets personGeneration allowAdult per preset', () => {
    expect(getReelAiPreset('product_centered')?.allowAdult).toBe(false);
    expect(getReelAiPreset('luxury')?.allowAdult).toBe(false);
    expect(getReelAiPreset('unboxing')?.allowAdult).toBe(false);
    expect(getReelAiPreset('explosive')?.allowAdult).toBe(false);
    expect(getReelAiPreset('ugc')?.allowAdult).toBe(true);
    expect(getReelAiPreset('exciting')?.allowAdult).toBe(true);
    expect(getReelAiPreset('outdoor')?.allowAdult).toBe(true);
    expect(getReelAiPreset('cozy')?.allowAdult).toBe(true);
  });

  it('builds a Veo prompt with product facts and constraints', () => {
    const prompt = buildVeoReelPrompt({
      presetId: 'product_centered',
      userPrompt: 'slow orbit',
      productName: 'Soap',
      productDescription: 'Handmade',
      brand: 'Acme',
    });
    expect(prompt).toContain('Soap');
    expect(prompt).toContain('Acme');
    expect(prompt).toContain('slow orbit');
    expect(prompt).toContain('identical to the reference photo');
  });

  it('uses only merchant text for custom preset', () => {
    const prompt = buildVeoReelPrompt({
      presetId: 'custom',
      userPrompt: 'soft steam rising',
      productName: 'Tea',
    });
    expect(prompt).toContain('soft steam rising');
    expect(prompt).not.toContain('Clean studio product ad');
  });
});
