import {
  metaCheckoutEventId,
  metaFunnelEventId,
  metaPurchaseEventId,
} from './metaEventIds';

describe('metaEventIds', () => {
  it('builds stable purchase event ids', () => {
    expect(metaPurchaseEventId('ord-1')).toBe('purchase-ord-1');
  });

  it('returns a non-empty funnel event id', () => {
    const id = metaFunnelEventId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(8);
  });

  it('builds deterministic checkout event ids from sorted cart keys', async () => {
    const a = await metaCheckoutEventId([
      {
        business_inventory_id: 'inv-b',
        quantity: 1,
      },
      {
        business_inventory_id: 'inv-a',
        quantity: 2,
        item_variant_id: 'var-1',
      },
    ]);
    const b = await metaCheckoutEventId([
      {
        business_inventory_id: 'inv-a',
        quantity: 2,
        item_variant_id: 'var-1',
      },
      {
        business_inventory_id: 'inv-b',
        quantity: 1,
      },
    ]);

    expect(a).toBe(b);
    expect(a.startsWith('checkout-')).toBe(true);
    expect(a.length).toBe('checkout-'.length + 32);
  });

  it('changes checkout event id when cart contents change', async () => {
    const a = await metaCheckoutEventId([
      { business_inventory_id: 'inv-a', quantity: 1 },
    ]);
    const b = await metaCheckoutEventId([
      { business_inventory_id: 'inv-a', quantity: 2 },
    ]);
    expect(a).not.toBe(b);
  });
});
