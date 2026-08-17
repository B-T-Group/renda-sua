import { HttpException, HttpStatus } from '@nestjs/common';
import {
  assertLocationConsentTransition,
  normalizeAgentLocationTrackingConsent,
} from './agent-location-consent.util';

describe('agent location consent utilities', () => {
  describe('normalizeAgentLocationTrackingConsent', () => {
    it('keeps known consent values', () => {
      expect(normalizeAgentLocationTrackingConsent('accepted')).toBe('accepted');
      expect(normalizeAgentLocationTrackingConsent('deferred')).toBe(
        'deferred'
      );
    });

    it('falls back to not_shown for unknown or missing values', () => {
      expect(normalizeAgentLocationTrackingConsent(null)).toBe('not_shown');
      expect(normalizeAgentLocationTrackingConsent('accepted_bg')).toBe(
        'not_shown'
      );
    });
  });

  describe('assertLocationConsentTransition', () => {
    it.each([
      ['not_shown', 'accepted'],
      ['not_shown', 'deferred'],
      ['deferred', 'accepted'],
    ] as const)('allows supported transition from %s to %s', (current, next) => {
      expect(() => assertLocationConsentTransition(current, next)).not.toThrow();
    });

    it('rejects unsupported transitions', () => {
      expect(() =>
        assertLocationConsentTransition('accepted', 'deferred')
      ).toThrow(HttpException);

      try {
        assertLocationConsentTransition('accepted', 'deferred');
      } catch (error: any) {
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(error.getResponse()).toEqual({
          success: false,
          error:
            'Cannot transition location_tracking_consent from accepted to deferred',
        });
      }
    });
  });
});
