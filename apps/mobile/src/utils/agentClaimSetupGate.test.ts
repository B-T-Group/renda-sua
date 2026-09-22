import {
  agentIdVerificationPending,
  agentNeedsIdUpload,
  agentNeedsMomoSetup,
} from './agentClaimSetupGate';

describe('agentClaimSetupGate', () => {
  it('treats approved MoMo ID as payout setup, not another ID upload', () => {
    const input = {
      isStripeRail: false,
      isVerified: false,
      idDocumentStatus: 'approved' as const,
    };
    expect(agentNeedsMomoSetup(input)).toBe(true);
    expect(agentNeedsIdUpload(input)).toBe(false);
    expect(agentIdVerificationPending(input)).toBe(false);
  });

  it('keeps missing and rejected on the Documents path', () => {
    expect(
      agentNeedsIdUpload({
        isStripeRail: false,
        isVerified: false,
        idDocumentStatus: 'missing',
      })
    ).toBe(true);
    expect(
      agentNeedsIdUpload({
        isStripeRail: false,
        isVerified: false,
        idDocumentStatus: 'rejected',
      })
    ).toBe(true);
    expect(
      agentNeedsMomoSetup({
        isStripeRail: false,
        isVerified: false,
        idDocumentStatus: 'missing',
      })
    ).toBe(false);
  });

  it('leaves Stripe rail unchanged', () => {
    const input = {
      isStripeRail: true,
      isVerified: false,
      idDocumentStatus: 'approved' as const,
    };
    expect(agentNeedsMomoSetup(input)).toBe(false);
    expect(agentNeedsIdUpload(input)).toBe(false);
    expect(agentIdVerificationPending(input)).toBe(false);
  });

  it('treats pending MoMo ID as under review, not upload or MoMo setup', () => {
    const input = {
      isStripeRail: false,
      isVerified: false,
      idDocumentStatus: 'pending' as const,
    };
    expect(agentIdVerificationPending(input)).toBe(true);
    expect(agentNeedsIdUpload(input)).toBe(false);
    expect(agentNeedsMomoSetup(input)).toBe(false);
  });
});
