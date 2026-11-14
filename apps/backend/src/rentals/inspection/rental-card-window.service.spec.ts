import { RentalCardWindowService } from './rental-card-window.service';

const NOW = new Date('2026-11-12T19:00:00.000Z');

function service(opts: {
  rail: 'stripe' | 'mobile_money';
  inspection?: boolean;
  hours?: number;
  timezone?: string | null;
  chargeAtPickup?: boolean;
}) {
  const routing = { resolveRailForCountry: jest.fn().mockResolvedValue(opts.rail) };
  const flags = {
    isEnabled: jest.fn().mockResolvedValue(opts.inspection !== false),
    numberConfig: jest.fn().mockResolvedValue(opts.hours ?? 72),
    cardChargeAtPickupEnabled: jest.fn().mockResolvedValue(opts.chargeAtPickup === true),
  };
  const hasura = {
    executeQuery: jest.fn().mockResolvedValue({
      country_delivery_configs: opts.timezone ? [{ config_value: opts.timezone }] : [],
    }),
  };
  return {
    svc: new RentalCardWindowService(routing as never, flags as never, hasura as never),
    routing,
    flags,
    hasura,
  };
}

describe('RentalCardWindowService', () => {
  it('uses the listing country rail, not a viewer rail, and the listing zone', async () => {
    const { svc, routing } = service({ rail: 'stripe', timezone: 'Africa/Douala' });
    const fields = await svc.forCountry('cm', NOW);
    expect(routing.resolveRailForCountry).toHaveBeenCalledWith('CM');
    expect(fields.payment_rail).toBe('stripe');
    expect(fields.momo_available).toBe(false);
    expect(fields.timezone).toBe('Africa/Douala');
    expect(fields.latest_card_end_at).toBe('2026-11-15T19:00:00.000Z');
    expect(fields.inspection_enabled).toBe(true);
    expect(fields.stripe_review_hours).toBe(72);
    expect(fields.card_auth_window_days).toBe(6);
  });

  it('keeps latest_card_end_at null when the listing country is not Stripe-rail', async () => {
    const { svc } = service({ rail: 'mobile_money', timezone: 'Africa/Douala' });
    const fields = await svc.forCountry('CM', NOW);
    expect(fields.payment_rail).toBe('mobile_money');
    expect(fields.momo_available).toBe(true);
    expect(fields.latest_card_end_at).toBeNull();
  });

  it('falls back to the listing zone when delivery config has no timezone', async () => {
    const { svc } = service({ rail: 'stripe', timezone: null });
    const fields = await svc.forCountry('CA', NOW);
    expect(fields.timezone).toBe('America/Toronto');
  });

  it('treats a missing country as mobile money in Douala time', async () => {
    const { svc, routing } = service({ rail: 'stripe' });
    const fields = await svc.forCountry(null, NOW);
    expect(routing.resolveRailForCountry).not.toHaveBeenCalled();
    expect(fields.payment_rail).toBe('mobile_money');
    expect(fields.timezone).toBe('Africa/Douala');
    expect(fields.latest_card_end_at).toBeNull();
  });

  it('returns charge_at_pickup with no cutoff when that flag is on for Stripe', async () => {
    const { svc } = service({ rail: 'stripe', timezone: 'Africa/Douala', chargeAtPickup: true });
    const fields = await svc.forCountry('CA', NOW);
    expect(fields.mode).toBe('charge_at_pickup');
    expect(fields.latest_card_end_at).toBeNull();
    expect(fields.payment_rail).toBe('stripe');
  });

  it('allows an end that lands exactly on the cutoff', async () => {
    const { svc } = service({ rail: 'stripe', timezone: 'Africa/Douala', hours: 72 });
    const fields = await svc.forCountry('CM', NOW);
    const end = new Date(fields.latest_card_end_at!);
    expect(end.getTime()).toBe(NOW.getTime() + 3 * 86400000);
  });

  it('keeps the country zone when the timezone query throws or is blank', async () => {
    const thrown = service({ rail: 'stripe', timezone: 'Africa/Douala' });
    thrown.hasura.executeQuery.mockRejectedValue(new Error('hasura down'));
    const canada = await thrown.svc.forCountry('ca', NOW);
    expect(canada.timezone).toBe('America/Toronto');
    expect(canada.payment_rail).toBe('stripe');
    expect(canada.latest_card_end_at).toBe('2026-11-15T19:00:00.000Z');
    const blank = service({ rail: 'stripe', timezone: '   ' });
    const unknown = await blank.svc.forCountry('ZZ', NOW);
    expect(unknown.timezone).toBe('Africa/Douala');
  });

  it('keeps the upfront cutoff when inspection is off or the pickup method is absent', async () => {
    const off = service({ rail: 'stripe', timezone: 'Africa/Douala', chargeAtPickup: true, inspection: false });
    const fields = await off.svc.forCountry('CM', NOW);
    expect(fields.inspection_enabled).toBe(false);
    expect(fields.mode).toBe('authorize_upfront');
    expect(fields.latest_card_end_at).toBe('2026-11-15T19:00:00.000Z');
    const missing = service({ rail: 'stripe', timezone: 'Africa/Douala', chargeAtPickup: true });
    delete (missing.flags as { cardChargeAtPickupEnabled?: unknown }).cardChargeAtPickupEnabled;
    const kept = await missing.svc.forCountry('CM', NOW);
    expect(kept.mode).toBe('authorize_upfront');
    expect(kept.latest_card_end_at).not.toBeNull();
  });

  it('reads each country once and treats a blank country as mobile money', async () => {
    const { svc, routing } = service({ rail: 'stripe', timezone: 'Africa/Douala' });
    const map = await svc.forCountries(['cm', ' CM ', null], NOW);
    expect([...map.keys()].sort()).toEqual(['', 'CM']);
    expect(routing.resolveRailForCountry).toHaveBeenCalledTimes(1);
    expect(routing.resolveRailForCountry).toHaveBeenCalledWith('CM');
    expect(map.get('CM')?.timezone).toBe('Africa/Douala');
    expect(map.get('')?.payment_rail).toBe('mobile_money');
    expect(map.get('')?.latest_card_end_at).toBeNull();
  });
});
