import { formatProgramMoney, advanceImpact, creditImpact, scheduleImpact } from './impact';

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
});
