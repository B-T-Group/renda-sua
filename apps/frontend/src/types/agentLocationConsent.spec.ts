import {
  hasAcceptedBackgroundLocationTrackingConsent,
  hasAcceptedLocationTrackingConsent,
  normalizeAgentLocationTrackingConsent,
} from './agentLocationConsent';

describe('agentLocationConsent', () => {
  it('normalizes unknown values to not_shown', () => {
    expect(normalizeAgentLocationTrackingConsent(null)).toBe('not_shown');
    expect(normalizeAgentLocationTrackingConsent('unknown')).toBe('not_shown');
  });

  it('allows foreground or background consent to start tracking', () => {
    expect(hasAcceptedLocationTrackingConsent('accepted_fg')).toBe(true);
    expect(hasAcceptedLocationTrackingConsent('accepted_bg')).toBe(true);
    expect(hasAcceptedLocationTrackingConsent('not_shown')).toBe(false);
  });

  it('requires background consent for background sync', () => {
    expect(hasAcceptedBackgroundLocationTrackingConsent('accepted_bg')).toBe(
      true
    );
    expect(hasAcceptedBackgroundLocationTrackingConsent('accepted_fg')).toBe(
      false
    );
  });
});
