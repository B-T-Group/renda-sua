import { resolveClaimReadiness } from './claimReadiness';

const ready = { isStripeRail: false, isVerified: true, idDocumentStatus: 'approved' as const, locationReady: true };

describe('resolveClaimReadiness', () => {
  it('asks for location before anything else', () => {
    expect(resolveClaimReadiness({ ...ready, isVerified: false, locationReady: false })?.titleDefault).toBe(
      'Turn on location'
    );
  });

  it('returns null when the agent can claim', () => {
    expect(resolveClaimReadiness(ready)).toBeNull();
  });
});