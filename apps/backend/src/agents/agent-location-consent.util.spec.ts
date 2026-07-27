import { HttpException, HttpStatus } from '@nestjs/common';
import {
  assertLocationConsentTransition,
  normalizeAgentLocationTrackingConsent,
} from './agent-location-consent.util';
import type { AgentLocationTrackingConsent } from './dto/update-location-tracking-consent.dto';

describe('agent-location-consent.util', () => {
  const expectTransitionAllowed = (
    current: AgentLocationTrackingConsent,
    next: AgentLocationTrackingConsent
  ) => {
    expect(() => assertLocationConsentTransition(current, next)).not.toThrow();
  };

  describe('normalizeAgentLocationTrackingConsent', () => {
    it('keeps valid consent values', () => {
      expect(normalizeAgentLocationTrackingConsent('accepted_fg')).toBe(
        'accepted_fg'
      );
      expect(normalizeAgentLocationTrackingConsent('accepted_bg')).toBe(
        'accepted_bg'
      );
    });

    it('defaults unknown or missing values to not_shown', () => {
      expect(normalizeAgentLocationTrackingConsent(null)).toBe('not_shown');
      expect(normalizeAgentLocationTrackingConsent(undefined)).toBe(
        'not_shown'
      );
      expect(normalizeAgentLocationTrackingConsent('allowed')).toBe(
        'not_shown'
      );
    });
  });

  describe('assertLocationConsentTransition', () => {
    it('allows idempotent consent updates', () => {
      expectTransitionAllowed('accepted_bg', 'accepted_bg');
    });

    it('allows first disclosure responses from not_shown', () => {
      expectTransitionAllowed('not_shown', 'accepted_fg');
      expectTransitionAllowed('not_shown', 'accepted_bg');
      expectTransitionAllowed('not_shown', 'rejected');
      expectTransitionAllowed('not_shown', 'deferred');
    });

    it('allows accepted states to reset disclosure to not_shown', () => {
      expectTransitionAllowed('accepted_fg', 'not_shown');
      expectTransitionAllowed('accepted_bg', 'not_shown');
    });

    it('allows foreground and background accepted states to switch', () => {
      expectTransitionAllowed('accepted_fg', 'accepted_bg');
      expectTransitionAllowed('accepted_bg', 'accepted_fg');
    });

    it('allows deferred consent to resolve or reset', () => {
      expectTransitionAllowed('deferred', 'accepted_fg');
      expectTransitionAllowed('deferred', 'accepted_bg');
      expectTransitionAllowed('deferred', 'rejected');
      expectTransitionAllowed('deferred', 'not_shown');
    });

    it('blocks rejected consent from moving directly to accepted', () => {
      expect(() =>
        assertLocationConsentTransition('rejected', 'accepted_bg')
      ).toThrow(
        new HttpException(
          {
            success: false,
            error:
              'Cannot transition location_tracking_consent from rejected to accepted_bg',
          },
          HttpStatus.BAD_REQUEST
        )
      );
    });

    it('returns a 400 status for invalid transitions', () => {
      try {
        assertLocationConsentTransition('accepted_fg', 'deferred');
        throw new Error('Expected transition to fail');
      } catch (error: any) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });
  });
});
