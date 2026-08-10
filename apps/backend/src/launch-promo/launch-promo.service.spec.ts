import { LaunchPromoService } from './launch-promo.service';

describe('LaunchPromoService', () => {
  const databaseService = { query: jest.fn() };
  const hasuraSystemService = { executeQuery: jest.fn() };
  const configurationsService = {
    getConfigurationByKey: jest.fn().mockResolvedValue({
      number_value: 15,
      status: 'active',
    }),
  };

  let service: LaunchPromoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LaunchPromoService(
      databaseService as never,
      hasuraSystemService as never,
      configurationsService as never
    );
  });

  it('claims a slot when the DB function returns a row', async () => {
    databaseService.query.mockResolvedValue([
      {
        id: 'slot-1',
        business_id: 'biz-1',
        country_code: 'CM',
        status: 'claimed',
        orders_remaining: 15,
        claimed_at: new Date('2026-08-01T00:00:00Z'),
      },
    ]);

    const slot = await service.claimSlotIfAvailable('biz-1', 'cm');
    expect(slot?.businessId).toBe('biz-1');
    expect(slot?.ordersRemaining).toBe(15);
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('claim_business_launch_promo_slot'),
      ['biz-1', 'CM']
    );
  });

  it('returns null when no slot is available', async () => {
    databaseService.query.mockResolvedValue([]);
    await expect(service.claimSlotIfAvailable('biz-1', 'CM')).resolves.toBeNull();
  });

  it('consumes a promo order when the DB function returns a row', async () => {
    databaseService.query.mockResolvedValue([{ id: 'slot-1' }]);
    await expect(service.consumePromoOrder('biz-1', 'order-1')).resolves.toBe(
      true
    );
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('consume_business_launch_promo_order'),
      ['biz-1', 'order-1']
    );
  });

  it('does not apply promo when consume returns empty', async () => {
    databaseService.query.mockResolvedValue([]);
    await expect(service.consumePromoOrder('biz-1', 'order-1')).resolves.toBe(
      false
    );
  });
});
