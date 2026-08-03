import { EnhancementConfidenceService } from './enhancement-confidence.service';

describe('EnhancementConfidenceService.computeTier', () => {
  const service = Object.create(
    EnhancementConfidenceService.prototype
  ) as EnhancementConfidenceService;

  it('returns high when similarity and self-check are green', () => {
    expect(
      service.computeTier({
        similarity: 0.95,
        selfCheck: 'cosmetic_only',
        validityPass: true,
        validityErrors: [],
      })
    ).toBe('high');
  });

  it('returns medium on minor ambiguity', () => {
    expect(
      service.computeTier({
        similarity: 0.95,
        selfCheck: 'minor_ambiguity',
        validityPass: true,
        validityErrors: [],
      })
    ).toBe('medium');
  });

  it('returns medium on mid similarity', () => {
    expect(
      service.computeTier({
        similarity: 0.8,
        selfCheck: 'cosmetic_only',
        validityPass: true,
        validityErrors: [],
      })
    ).toBe('medium');
  });

  it('returns low when product is altered', () => {
    expect(
      service.computeTier({
        similarity: 0.99,
        selfCheck: 'altered',
        validityPass: true,
        validityErrors: [],
      })
    ).toBe('low');
  });

  it('returns low when similarity is below floor', () => {
    expect(
      service.computeTier({
        similarity: 0.5,
        selfCheck: 'cosmetic_only',
        validityPass: true,
        validityErrors: [],
      })
    ).toBe('low');
  });

  it('returns low when validity fails', () => {
    expect(
      service.computeTier({
        similarity: 0.99,
        selfCheck: 'cosmetic_only',
        validityPass: false,
        validityErrors: ['resolution_too_low'],
      })
    ).toBe('low');
  });
});
