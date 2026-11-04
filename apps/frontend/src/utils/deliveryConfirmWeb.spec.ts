import { confirmActions, deliveryConfirmSource, minutesLeft, personaPlan } from './deliveryConfirmWeb';

describe('deliveryConfirmWeb', () => {
  it('parses source', () => {
    expect(deliveryConfirmSource('wa')).toBe('wa');
    expect(deliveryConfirmSource('evil')).toBe('in_app');
    expect(deliveryConfirmSource(null)).toBe('in_app');
  });
  it('switches persona before rendering, or shows the safe screen', () => {
    expect(personaPlan({ requested: 'client', active: 'client', personas: ['client'] })).toBe('render');
    expect(personaPlan({ requested: 'client', active: 'agent', personas: ['agent', 'client'] })).toBe('switch');
    expect(personaPlan({ requested: 'client', active: 'agent', personas: ['agent'] })).toBe('wrong_account');
    expect(personaPlan({ requested: 'business', active: 'business', personas: ['business'] })).toBe('wrong_account');
  });
  it('countdown uses server time', () => {
    const fetched = Date.parse('2026-11-04T10:00:00Z');
    // client clock 10 min behind the server
    expect(minutesLeft('2026-11-04T12:10:00Z', '2026-11-04T10:10:00Z', fetched, fetched)).toBe(120);
    expect(minutesLeft('2026-11-04T09:00:00Z', null, fetched, fetched)).toBe(0);
    expect(minutesLeft(null, null, fetched, fetched)).toBeNull();
  });
  it('offline disables every action', () => {
    const s = { canComplete: true, canReport: true };
    expect(confirmActions(s, true)).toEqual({ complete: false, report: false, failed: false });
    expect(confirmActions(s, false)).toEqual({ complete: true, report: true, failed: true });
    expect(confirmActions({ canReportAfterCompletion: true }, false)).toEqual({ complete: false, report: true, failed: true });
  });
});
