import {
  groupEarnedByAgent,
  primaryEarned,
} from './admin-performance-earnings.util';

describe('admin-performance-earnings.util', () => {
  it('sums credited amounts per agent and per referred business', () => {
    const totals = groupEarnedByAgent([
      {
        earner_agent_id: 'agent-1',
        business_id: 'biz-1',
        amount: '7500',
        currency: 'XAF',
      },
      {
        earner_agent_id: 'agent-1',
        business_id: 'biz-1',
        amount: 75,
        currency: 'XAF',
      },
      {
        earner_agent_id: 'agent-1',
        business_id: 'biz-2',
        amount: 100,
        currency: 'XAF',
      },
      {
        earner_agent_id: 'agent-2',
        business_id: 'biz-3',
        amount: 25,
        currency: 'CAD',
      },
    ]);

    expect(primaryEarned(totals.get('agent-1'))).toEqual({
      amount: 7675,
      currency: 'XAF',
    });
    expect(totals.get('agent-1')?.byBusiness.get('biz-1')).toBe(7575);
    expect(primaryEarned(totals.get('agent-2'))).toEqual({
      amount: 25,
      currency: 'CAD',
    });
  });

  it('picks the currency with the larger total when mixed', () => {
    const totals = groupEarnedByAgent([
      {
        earner_agent_id: 'agent-1',
        business_id: 'biz-1',
        amount: 7500,
        currency: 'XAF',
      },
      {
        earner_agent_id: 'agent-1',
        business_id: 'biz-2',
        amount: 25,
        currency: 'CAD',
      },
    ]);
    expect(primaryEarned(totals.get('agent-1'))).toEqual({
      amount: 7500,
      currency: 'XAF',
    });
  });

  it('returns zero XAF when there are no events', () => {
    expect(primaryEarned(undefined)).toEqual({ amount: 0, currency: 'XAF' });
    expect(groupEarnedByAgent([]).size).toBe(0);
  });
});
