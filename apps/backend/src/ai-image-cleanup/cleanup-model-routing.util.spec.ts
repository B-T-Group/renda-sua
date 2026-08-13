import { VALIDATION_CODES } from '../image-validation/types/image-validation.types';
import {
  DEFAULT_OPENAI_IMAGE_CLEANUP_MODEL,
  extractValidationCodes,
  parseOpenAiImageCleanupModel,
  routeCleanupModel,
} from './cleanup-model-routing.util';

describe('cleanup-model-routing.util', () => {
  describe('parseOpenAiImageCleanupModel', () => {
    it('defaults to gpt-image-1-mini', () => {
      expect(parseOpenAiImageCleanupModel(undefined)).toBe(
        DEFAULT_OPENAI_IMAGE_CLEANUP_MODEL
      );
      expect(parseOpenAiImageCleanupModel('')).toBe('gpt-image-1-mini');
      expect(parseOpenAiImageCleanupModel('unknown')).toBe('gpt-image-1-mini');
    });

    it('accepts gpt-image-1.5', () => {
      expect(parseOpenAiImageCleanupModel('gpt-image-1.5')).toBe(
        'gpt-image-1.5'
      );
    });
  });

  describe('extractValidationCodes', () => {
    it('reads code from issue objects', () => {
      expect(
        extractValidationCodes([
          { code: VALIDATION_CODES.POOR_LIGHTING },
          { message: 'no code' },
        ])
      ).toEqual([VALIDATION_CODES.POOR_LIGHTING]);
    });
  });

  describe('routeCleanupModel', () => {
    it('skips inappropriate content', () => {
      expect(
        routeCleanupModel({
          adminDefaultModel: 'gpt-image-1-mini',
          issueCodes: [],
          errorCodes: [VALIDATION_CODES.INAPPROPRIATE_CONTENT],
          qualityScore: 50,
          width: 1200,
          height: 1200,
        })
      ).toBe('skip');
    });

    it('skips catalog-ready photos with no cleanup-worthy codes when not explicit', () => {
      expect(
        routeCleanupModel({
          adminDefaultModel: 'gpt-image-1-mini',
          issueCodes: [VALIDATION_CODES.DUPLICATE_IMAGE],
          qualityScore: 95,
          width: 1200,
          height: 1200,
        })
      ).toBe('skip');
    });

    it('still edits on explicit request when local codes are empty', () => {
      expect(
        routeCleanupModel({
          adminDefaultModel: 'gpt-image-1-mini',
          issueCodes: [],
          qualityScore: 100,
          width: 1200,
          height: 1200,
          explicitRequest: true,
        })
      ).toBe('gpt-image-1-mini');
    });

    it('routes clutter/lighting to mini', () => {
      expect(
        routeCleanupModel({
          adminDefaultModel: 'gpt-image-1-mini',
          issueCodes: [VALIDATION_CODES.CLUTTERED_BACKGROUND],
          qualityScore: 80,
          width: 1200,
          height: 1200,
        })
      ).toBe('gpt-image-1-mini');
    });

    it('upgrades blurry photos to gpt-image-1.5 when default is mini', () => {
      expect(
        routeCleanupModel({
          adminDefaultModel: 'gpt-image-1-mini',
          issueCodes: [VALIDATION_CODES.IMAGE_BLURRY],
          qualityScore: 60,
          width: 1200,
          height: 1200,
        })
      ).toBe('gpt-image-1.5');
    });

    it('forces gpt-image-1.5 when admin config overrides', () => {
      expect(
        routeCleanupModel({
          adminDefaultModel: 'gpt-image-1.5',
          issueCodes: [VALIDATION_CODES.POOR_LIGHTING],
          qualityScore: 80,
          width: 1200,
          height: 1200,
        })
      ).toBe('gpt-image-1.5');
    });

    it('skips when not explicit and no cleanup-worthy codes', () => {
      expect(
        routeCleanupModel({
          adminDefaultModel: 'gpt-image-1-mini',
          issueCodes: [],
          qualityScore: 70,
          width: 1200,
          height: 1200,
        })
      ).toBe('skip');
    });
  });
});
