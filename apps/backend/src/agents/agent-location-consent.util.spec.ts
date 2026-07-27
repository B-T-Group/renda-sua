import { HttpException, HttpStatus } from '@nestjs/common';
import {
  assertLocationConsentTransition,
  normalizeAgentLocationTrackingConsent,
} from './agent-location-consent.util';
import {
  AGENT_LOCATION_TRACKING_CONSENT_VALUES,
  type AgentLocationTrackingConsent,
} from './dto/update-location-tracking-consent.dto';

describe('agent-location-consent.util', () => {
  const allowedTransitions: Record<
    AgentLocationTrackingConsent,
    AgentLocationTrackingConsent[]
  > = {
    not_shown: ['accepted_fg', 'accepted_bg', 'rejected', 'deferred'],
    accepted_fg: ['accepted_bg', 'rejected'],
    accepted_bg: ['accepted_fg', 'rejected'],
    rejected: ['not_shown'],
    deferred: ['accepted_fg', 'accepted_bg', 'rejected', 'not_shown'],
  };

  function expectTransitionRejected(
    current: AgentLocationTrackingConsent,
    next: AgentLocationTrackingConsent
  ) {
    try {
      assertLocationConsentTransition(current, next);
      throw new Error('Expected transition to reject');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.getResponse()).toEqual({
        success: false,
        error: `Cannot transition location_tracking_consent from ${current} to ${next}`,
      });
    }
  }

  it('returns valid consent values unchanged', () => {
    for (const value of AGENT_LOCATION_TRACKING_CONSENT_VALUES) {
      expect(normalizeAgentLocationTrackingConsent(value)).toBe(value);
    }
  });

  it('normalizes missing or unexpected values to not_shown', () => {
    const invalidValues = [null, undefined, '', 'bogus', 123, {}];
    for (const value of invalidValues) {
      expect(normalizeAgentLocationTrackingConsent(value)).toBe('not_shown');
    }
  });

  it('allows every configured transition and idempotent writes', () => {
    for (const current of AGENT_LOCATION_TRACKING_CONSENT_VALUES) {
      expect(() => assertLocationConsentTransition(current, current)).not.toThrow();
      for (const next of allowedTransitions[current]) {
        expect(() => assertLocationConsentTransition(current, next)).not.toThrow();
      }
    }
  });

  it('rejects transitions outside the consent state machine', () => {
    for (const current of AGENT_LOCATION_TRACKING_CONSENT_VALUES) {
      for (const next of AGENT_LOCATION_TRACKING_CONSENT_VALUES) {
        if (current === next || allowedTransitions[current].includes(next)) {
          continue;
        }
        expectTransitionRejected(current, next);
      }
    }
  });
});
