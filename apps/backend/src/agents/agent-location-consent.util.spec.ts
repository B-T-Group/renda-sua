import { HttpException, HttpStatus } from '@nestjs/common';
import {
  assertLocationConsentTransition,
  normalizeAgentLocationTrackingConsent,
} from './agent-location-consent.util';

describe('agent location consent utilities', () => {
  describe('normalizeAgentLocationTrackingConsent', () => {
    it('keeps known consent values', () => {
      expect(normalizeAgentLocationTrackingConsent('accepted_bg')).toBe(
        'accepted_bg'
      );
      expect(normalizeAgentLocationTrackingConsent('deferred')).toBe(
        'deferred'
      );
    });

    it('falls back to not_shown for unknown or missing values', () => {
      expect(normalizeAgentLocationTrackingConsent(null)).toBe('not_shown');
      expect(normalizeAgentLocationTrackingConsent('accepted')).toBe(
        'not_shown'
      );
    });
  });

  describe('assertLocationConsentTransition', () => {
    it.each([
      ['accepted_fg', 'not_shown'],
      ['accepted_bg', 'not_shown'],
      ['rejected', 'not_shown'],
      ['deferred', 'not_shown'],
    ] as const)('allows resetting %s disclosure to %s', (current, next) => {
      expect(() => assertLocationConsentTransition(current, next)).not.toThrow();
    });

    it('allows foreground and background acceptance upgrades', () => {
      expect(() =>
        assertLocationConsentTransition('accepted_fg', 'accepted_bg')
      ).not.toThrow();
      expect(() =>
        assertLocationConsentTransition('accepted_bg', 'accepted_fg')
      ).not.toThrow();
    });

    it('rejects direct consent after a rejection without resetting disclosure', () => {
      expect(() =>
        assertLocationConsentTransition('rejected', 'accepted_fg')
      ).toThrow(HttpException);

      try {
        assertLocationConsentTransition('rejected', 'accepted_fg');
      } catch (error: any) {
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(error.getResponse()).toEqual({
          success: false,
          error:
            'Cannot transition location_tracking_consent from rejected to accepted_fg',
        });
      }
    });
  });
});
