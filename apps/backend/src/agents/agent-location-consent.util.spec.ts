import {
  hasAcceptedAgentLocationTrackingConsent,
  normalizeAgentLocationTrackingConsent,
} from './agent-location-consent.util';

describe('agent-location-consent.util', () => {
  it('normalizes unknown consent values to not_shown', () => {
    expect(normalizeAgentLocationTrackingConsent(undefined)).toBe('not_shown');
    expect(normalizeAgentLocationTrackingConsent('invalid')).toBe('not_shown');
  });

  it('treats only accepted consent values as location tracking permission', () => {
    expect(hasAcceptedAgentLocationTrackingConsent('accepted_fg')).toBe(true);
    expect(hasAcceptedAgentLocationTrackingConsent('accepted_bg')).toBe(true);
    expect(hasAcceptedAgentLocationTrackingConsent('rejected')).toBe(false);
    expect(hasAcceptedAgentLocationTrackingConsent('deferred')).toBe(false);
    expect(hasAcceptedAgentLocationTrackingConsent('not_shown')).toBe(false);
  });
});
