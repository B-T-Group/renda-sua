import { HttpException, HttpStatus } from '@nestjs/common';
import {
  assertLocationConsentTransition,
  normalizeAgentLocationTrackingConsent,
} from './agent-location-consent.util';
import { AGENT_LOCATION_TRACKING_CONSENT_VALUES } from './dto/update-location-tracking-consent.dto';

describe('agent location consent utilities', () => {
  describe('normalizeAgentLocationTrackingConsent', () => {
    it('preserves every persisted consent enum value', () => {
      for (const consent of AGENT_LOCATION_TRACKING_CONSENT_VALUES) {
        expect(normalizeAgentLocationTrackingConsent(consent)).toBe(consent);
      }
    });

    it('defaults missing or unknown database values to not_shown', () => {
      expect(normalizeAgentLocationTrackingConsent(null)).toBe('not_shown');
      expect(normalizeAgentLocationTrackingConsent(undefined)).toBe('not_shown');
      expect(normalizeAgentLocationTrackingConsent('accepted')).toBe('not_shown');
    });
  });

  describe('assertLocationConsentTransition', () => {
    it('allows idempotent updates and supported consent flow transitions', () => {
      expect(() =>
        assertLocationConsentTransition('accepted_fg', 'accepted_fg')
      ).not.toThrow();
      expect(() =>
        assertLocationConsentTransition('not_shown', 'accepted_bg')
      ).not.toThrow();
      expect(() =>
        assertLocationConsentTransition('deferred', 'not_shown')
      ).not.toThrow();
      expect(() =>
        assertLocationConsentTransition('rejected', 'not_shown')
      ).not.toThrow();
    });

    it('rejects unsupported transitions with a bad request response', () => {
      expect(() =>
        assertLocationConsentTransition('accepted_fg', 'deferred')
      ).toThrow(
        new HttpException(
          {
            success: false,
            error:
              'Cannot transition location_tracking_consent from accepted_fg to deferred',
          },
          HttpStatus.BAD_REQUEST
        )
      );
    });
  });
});
