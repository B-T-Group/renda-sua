import { HttpException, HttpStatus } from '@nestjs/common';
import {
  assertLocationConsentTransition,
  normalizeAgentLocationTrackingConsent,
} from './agent-location-consent.util';

describe('agent-location-consent.util', () => {
  describe('normalizeAgentLocationTrackingConsent', () => {
    it('keeps known consent values unchanged', () => {
      expect(normalizeAgentLocationTrackingConsent('accepted_bg')).toBe(
        'accepted_bg'
      );
      expect(normalizeAgentLocationTrackingConsent('deferred')).toBe(
        'deferred'
      );
    });

    it('falls back to not_shown for missing or unknown consent values', () => {
      expect(normalizeAgentLocationTrackingConsent(null)).toBe('not_shown');
      expect(normalizeAgentLocationTrackingConsent(undefined)).toBe(
        'not_shown'
      );
      expect(normalizeAgentLocationTrackingConsent('accepted')).toBe(
        'not_shown'
      );
    });
  });

  describe('assertLocationConsentTransition', () => {
    it.each([
      ['not_shown', 'accepted_fg'],
      ['not_shown', 'accepted_bg'],
      ['not_shown', 'rejected'],
      ['not_shown', 'deferred'],
      ['accepted_fg', 'accepted_bg'],
      ['accepted_fg', 'rejected'],
      ['accepted_fg', 'not_shown'],
      ['accepted_bg', 'accepted_fg'],
      ['accepted_bg', 'rejected'],
      ['accepted_bg', 'not_shown'],
      ['rejected', 'not_shown'],
      ['deferred', 'accepted_fg'],
      ['deferred', 'accepted_bg'],
      ['deferred', 'rejected'],
      ['deferred', 'not_shown'],
    ] as const)('allows %s to %s', (current, next) => {
      expect(() => assertLocationConsentTransition(current, next)).not.toThrow();
    });

    it('allows idempotent transitions', () => {
      expect(() =>
        assertLocationConsentTransition('accepted_fg', 'accepted_fg')
      ).not.toThrow();
    });

    it('rejects invalid consent transitions with a bad request error', () => {
      expect(() =>
        assertLocationConsentTransition('accepted_fg', 'deferred')
      ).toThrow(HttpException);

      try {
        assertLocationConsentTransition('accepted_fg', 'deferred');
      } catch (error: any) {
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(error.getResponse()).toEqual({
          success: false,
          error:
            'Cannot transition location_tracking_consent from accepted_fg to deferred',
        });
      }
    });
  });
});
