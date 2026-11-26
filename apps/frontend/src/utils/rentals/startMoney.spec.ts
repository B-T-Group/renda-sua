import { startMoney, startMoneyLines } from './startMoney';

const t = (_key: string, fallback: string, vars: Record<string, string> = {}) =>
  fallback.replace(/{{(\w+)}}/g, (_m, k: string) => vars[k] ?? '');
const cad = (n: number) => `$${n.toFixed(2)}`;

describe('startMoney', () => {
  it('shows the Stripe hold as rental + deposit when the authorization is both', () => {
    const money = startMoney({ currency: 'CAD', payment_status: 'authorized', total_amount: '60', security_deposit_amount: '160', authorized_amount: '220' });
    expect(money).toEqual({ kind: 'card', held: 220, rental: 60, deposit: 160, split: true });
    expect(startMoneyLines(money, cad, t)).toEqual({
      main: '$220.00 held on your card',
      sub: '$60.00 rental · $160.00 security deposit',
      icon: 'card',
    });
  });

  it('shows one line when there is no deposit', () => {
    const money = startMoney({ currency: 'CAD', payment_status: 'authorized', total_amount: 60, security_deposit_amount: 0, authorized_amount: 60 });
    expect(startMoneyLines(money, cad, t)).toEqual({ main: '$60.00 held on your card', sub: null, icon: 'card' });
  });

  it('shows the real authorization alone when it is not rental + deposit', () => {
    const money = startMoney({ currency: 'CAD', payment_status: 'authorized', total_amount: 60, security_deposit_amount: 160, authorized_amount: 200 });
    expect(money).toEqual({ kind: 'card', held: 200, rental: 60, deposit: 160, split: false });
    expect(startMoneyLines(money, cad, t).sub).toBeNull();
  });

  it('falls back to rental + deposit when the authorization amount is missing', () => {
    expect(startMoney({ currency: 'CAD', payment_status: 'authorized', total_amount: 60, security_deposit_amount: 160, authorized_amount: null }))
      .toEqual({ kind: 'card', held: 220, rental: 60, deposit: 160, split: true });
  });

  it('charges Mobile Money at start for an unpaid FCFA booking, with no deposit', () => {
    const money = startMoney({ currency: 'XAF', payment_status: 'pending', total_amount: 15000, security_deposit_amount: 20000, accept_start_preview: { payment_rail: 'mobile_money', amount_due_at_pickup: 15000 } });
    expect(money).toEqual({ kind: 'momo_due', amount: 15000 });
    expect(startMoneyLines(money, (n) => `${n} FCFA`, t)).toEqual({ main: 'Mobile Money · 15000 FCFA', sub: null, icon: 'momo' });
  });

  it('says will be paid from your wallet before Start when the server preview shows the wallet covers an FCFA booking', () => {
    const money = startMoney({ currency: 'XAF', payment_status: 'pending', total_amount: 15000, accept_start_preview: { payment_rail: 'wallet', amount_due_at_pickup: 15000 } });
    expect(money).toEqual({ kind: 'wallet_due', amount: 15000 });
    expect(startMoneyLines(money, (n) => `${n} FCFA`, t)).toEqual({ main: '15000 FCFA will be paid from your wallet', sub: null, icon: 'wallet' });
  });

  it('keeps Mobile Money when the wallet does not cover it or the preview is missing', () => {
    expect(startMoney({ currency: 'XAF', payment_status: 'pending', total_amount: 15000, accept_start_preview: { payment_rail: 'mobile_money', amount_due_at_pickup: 15000 } }).kind).toBe('momo_due');
    expect(startMoney({ currency: 'XAF', payment_status: 'pending', total_amount: 15000, accept_start_preview: null })).toEqual({ kind: 'momo_due', amount: 15000 });
  });

  it('never says card for a paid FCFA booking', () => {
    const base = { currency: 'XAF', payment_status: 'paid', total_amount: 15000 };
    expect(startMoneyLines(startMoney({ ...base, accept_start_preview: { paid_rail: 'mobile_money' } }), (n) => `${n} FCFA`, t).main).toBe('15000 FCFA paid with Mobile Money');
    expect(startMoneyLines(startMoney({ ...base, accept_start_preview: { paid_rail: 'wallet' } }), (n) => `${n} FCFA`, t).main).toBe('15000 FCFA paid from your wallet');
    expect(startMoneyLines(startMoney(base), (n) => `${n} FCFA`, t)).toEqual({ main: '15000 FCFA paid', sub: null, icon: 'wallet' });
  });
});

describe('Start rental dialog copy (web locales)', () => {
  const fr = require('../../../public/locales/fr.json');
  const en = require('../../../public/locales/en.json');

  it('has the primary button in both languages', () => {
    expect(fr.rentals.actions.startRental).toBe('Démarrer la location');
    expect(en.rentals.actions.startRental).toBe('Start rental');
  });

  it('keeps 30 minutes together and a non-breaking space before French question marks', () => {
    expect(en.rentals.start.didntHint).toContain('30\u00a0minutes');
    expect(fr.rentals.start.didntHint).toContain('démarrage\u00a0?');
    expect(fr.rentals.start.didntHint).toContain('30\u00a0minutes');
    expect(fr.rentals.start.confirmTitle).toBe('Démarrer la location\u00a0?');
  });
});
