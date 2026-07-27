import { HttpException, HttpStatus } from '@nestjs/common';
import {
  assertLocationConsentTransition,
  normalizeAgentLocationTrackingConsent,
} from './agent-location-consent.util';

describe('agent-location-consent.util', () => {
  describe('normalizeAgentLocationTrackingConsent', () => {
    it('keeps known persisted consent values', () => {
      expect(normalizeAgentLocationTrackingConsent('not_shown')).toBe(
        'not_shown'
      );
      expect(normalizeAgentLocationTrackingConsent('accepted')).toBe('accepted');
      expect(normalizeAgentLocationTrackingConsent('deferred')).toBe('deferred');
    });

    it('defaults unknown persisted consent values to not_shown', () => {
      expect(normalizeAgentLocationTrackingConsent('legacy')).toBe('not_shown');
      expect(normalizeAgentLocationTrackingConsent(null)).toBe('not_shown');
      expect(normalizeAgentLocationTrackingConsent(undefined)).toBe('not_shown');
    });
  });

  describe('assertLocationConsentTransition', () => {
    it('allows first-choice and accepted-from-deferred transitions', () => {
      expect(() =>
        assertLocationConsentTransition('not_shown', 'accepted')
      ).not.toThrow();
      expect(() =>
        assertLocationConsentTransition('not_shown', 'deferred')
      ).not.toThrow();
      expect(() =>
        assertLocationConsentTransition('deferred', 'accepted')
      ).not.toThrow();
    });

    it('allows idempotent writes for the same consent value', () => {
      expect(() =>
        assertLocationConsentTransition('accepted', 'accepted')
      ).not.toThrow();
      expect(() =>
        assertLocationConsentTransition('deferred', 'deferred')
      ).not.toThrow();
    });

    it('rejects regressive consent transitions', () => {
      expect(() =>
        assertLocationConsentTransition('accepted', 'deferred')
      ).toThrow(
        new HttpException(
          {
            success: false,
            error:
              'Cannot transition location_tracking_consent from accepted to deferred',
          },
          HttpStatus.BAD_REQUEST
        )
      );
    });
  });
});
