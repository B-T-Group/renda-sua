import { buildDeliveryAvailabilityContext } from './build-delivery-availability-context';

describe('buildDeliveryAvailabilityContext', () => {
  it('normalizes seller country and coordinates the same way for every caller', () => {
    const context = buildDeliveryAvailabilityContext({
      businessId: 'biz-1',
      sellerCountry: 'Gabon',
      sellerState: ' Estuaire ',
      pickupLat: '0.4',
      pickupLon: '',
      deliveryLat: null,
      itemIds: ['item-1', 'item-1', null],
      inventoryIds: ['inv-1'],
    });

    expect(context.sellerCountry).toBe('GA');
    expect(context.sellerState).toBe('Estuaire');
    expect(context.pickupLat).toBe(0.4);
    expect(context.pickupLon).toBeNull();
    expect(context.deliveryLat).toBeNull();
    expect(context.itemIds).toEqual(['item-1']);
    expect(context.inventoryIds).toEqual(['inv-1']);
  });

  it('keeps a missing seller country empty', () => {
    const context = buildDeliveryAvailabilityContext({
      businessId: 'biz-1',
      sellerCountry: '  ',
    });

    expect(context.sellerCountry).toBe('');
  });

  it('#594: passes the scheduled-window request through, and omits it otherwise', () => {
    const dedicated = {
      slotId: 'slot-a',
      preferredDate: '2026-10-20',
      rail: 'stripe' as const,
      subtotal: 120,
      currency: 'CAD',
    };
    expect(
      buildDeliveryAvailabilityContext({ businessId: 'biz-1', dedicated }).dedicated
    ).toEqual(dedicated);
    expect(buildDeliveryAvailabilityContext({ businessId: 'biz-1', dedicated: null })).not.toHaveProperty('dedicated');
    expect(buildDeliveryAvailabilityContext({ businessId: 'biz-1' })).not.toHaveProperty('dedicated');
  });
});
