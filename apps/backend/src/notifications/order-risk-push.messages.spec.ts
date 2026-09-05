import {
  buildOrderRiskActionSummary,
  buildOrderRiskSuperuserPushMessage,
} from './order-risk-push.messages';

const ACTION = {
  businessName: 'Chez Marie',
  locationName: 'Glass',
  merchantPhone: '+241011223344',
  clientName: 'Paul N.',
  amountLabel: '12500 XAF',
  minutesUntilAutoDecline: 5,
};

describe('buildOrderRiskActionSummary', () => {
  it('gives the operator the merchant, the number to call, and the countdown', () => {
    const summary = buildOrderRiskActionSummary(
      'Merchant missed the acceptance deadline',
      ACTION
    );
    expect(summary).toBe(
      'Merchant missed the acceptance deadline. Chez Marie at Glass. ' +
        'Call +241011223344. Client Paul N.. 12500 XAF. Auto-cancel in 5 min'
    );
  });

  it('falls back to the bare reason when nothing could be loaded', () => {
    expect(buildOrderRiskActionSummary('Agent has not picked up')).toBe(
      'Agent has not picked up'
    );
  });

  it('skips the fields that are missing rather than printing blanks', () => {
    expect(
      buildOrderRiskActionSummary('Not confirmed', {
        businessName: 'Chez Marie',
        merchantPhone: null,
        clientName: null,
      })
    ).toBe('Not confirmed. Chez Marie');
  });

  it('stays inside the WhatsApp variable budget', () => {
    const summary = buildOrderRiskActionSummary('x'.repeat(500), ACTION);
    expect(summary.length).toBeLessThanOrEqual(300);
  });
});

describe('buildOrderRiskSuperuserPushMessage', () => {
  it('carries the action detail into the push body', () => {
    const { title, body } = buildOrderRiskSuperuserPushMessage({
      orderNumber: 'RS-42',
      riskType: 'pending_acceptance',
      severity: 'critical',
      reason: 'Merchant missed the acceptance deadline',
      action: ACTION,
    });
    expect(title).toBe('[Critical] Order RS-42 at risk');
    expect(body).toContain('Not confirmed by merchant');
    expect(body).toContain('Call +241011223344');
  });
});
