import { HttpException, HttpStatus } from '@nestjs/common';
import {
  assertLocationConsentTransition,
  normalizeAgentLocationTrackingConsent,
} from './agent-location-consent.util';

describe('agent-location-consent.util', () => {
  describe('normalizeAgentLocationTrackingConsent', () => {
    it.each([
      'not_shown',
      'accepted_fg',
      'accepted_bg',
      'rejected',
      'deferred',
    ])('keeps valid consent value %s', (value) => {
      expect(normalizeAgentLocationTrackingConsent(value)).toBe(value);
    });

    it.each([undefined, null, '', 'accepted', 'accepted_background', 1, true])(
      'defaults invalid consent value %p to not_shown',
      (value) => {
        expect(normalizeAgentLocationTrackingConsent(value)).toBe('not_shown');
      }
    );
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
    ] as const)('allows %s -> %s', (current, next) => {
      expect(() => assertLocationConsentTransition(current, next)).not.toThrow();
    });

    it.each([
      'not_shown',
      'accepted_fg',
      'accepted_bg',
      'rejected',
      'deferred',
    ] as const)('allows idempotent %s updates', (consent) => {
      expect(() =>
        assertLocationConsentTransition(consent, consent)
      ).not.toThrow();
    });

    it.each([
      ['rejected', 'accepted_fg'],
      ['rejected', 'accepted_bg'],
      ['rejected', 'deferred'],
      ['accepted_fg', 'deferred'],
      ['accepted_bg', 'deferred'],
    ] as const)('rejects %s -> %s', (current, next) => {
      expect(() => assertLocationConsentTransition(current, next)).toThrow(
        new HttpException(
          {
            success: false,
            error: `Cannot transition location_tracking_consent from ${current} to ${next}`,
          },
          HttpStatus.BAD_REQUEST
        )
      );
    });
  });
});
