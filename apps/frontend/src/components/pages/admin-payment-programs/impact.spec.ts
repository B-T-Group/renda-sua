import { formatProgramMoney, advanceImpact, campaignImpact, creditImpact, scheduleImpact } from './impact';

const t = (key: string, fallback: string, options?: Record<string, string>) => {
  return fallback.replace(/\{\{(\w+)\}\}/g, (_, name) => options?.[name] ?? '');
};

describe('payment program impact', () => {
  it('states the schedule amount and cadence', () => {
    const text = scheduleImpact(t, {
      amount: '10000',
      currency: 'XAF',
      frequency: 'daily',
      locale: 'en',
    });
    expect(text).toContain(formatProgramMoney('10000', 'XAF', 'en'));
    expect(text).toContain('every day');
    expect(text).toContain('assigned to an agent');
  });

  it('adds objectives when they are provided', () => {
    const text = scheduleImpact(t, {
      amount: '10000',
      currency: 'XAF',
      frequency: 'weekly',
      locale: 'en',
      objectives: {
        targetAgentRecruitments: '5',
        targetItemSalesAmount: '20000',
      },
    });
    expect(text).toContain('Objectives: 5 agent recruitments and');
    expect(text).toContain('in item sales');
  });

  it('names the agent and the duration', () => {
    const text = scheduleImpact(t, {
      amount: '500',
      currency: 'XAF',
      frequency: 'weekly',
      days: '30',
      name: 'Ada',
      locale: 'en',
    });
    expect(text).toContain('Ada');
    expect(text).toContain('30');
    expect(text).toContain('every week');
  });

  it('asks for an amount before promising money', () => {
    expect(advanceImpact(t, { amount: '', currency: 'XAF', locale: 'en' })).toContain('Enter an amount');
  });

  it('describes store credit scope', () => {
    const text = creditImpact(t, {
      amount: '250',
      currency: 'XAF',
      scope: 'specific_business',
      storeName: 'Ada Shop',
      clientName: 'Bea',
      locale: 'en',
    });
    expect(text).toContain('Bea');
    expect(text).toContain('Ada Shop');
    expect(text).toContain('cannot be withdrawn');
  });

  it('explains a signup campaign before it is created', () => {
    const text = campaignImpact(t, {
      persona: 'client',
      market: 'CM',
      currency: 'XAF',
      locale: 'en',
      storeScope: 'any_store',
      subjectAmount: '500',
      bonus: '250',
      referrerAmount: '250',
      cap: '5',
      expiresDays: '30',
      hasWindow: true,
    });
    expect(text).toContain('client');
    expect(text).toContain('CM');
    expect(text).toContain('cannot be withdrawn');
    expect(text).toContain('5');
    expect(text).toContain('30');
  });
});
