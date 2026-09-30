import { CommissionsService } from './commissions.service';
import type { CommissionConfig } from './types';

describe('waived delivery agent earnings', () => {
  const service = new CommissionsService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );

  const config: CommissionConfig = {
    rendasuaItemCommissionPercentage: 12,
    unverifiedAgentBaseDeliveryCommission: 50,
    verifiedAgentBaseDeliveryCommission: 0,
    unverifiedAgentPerKmDeliveryCommission: 80,
    verifiedAgentPerKmDeliveryCommission: 20,
  };

  it('pays the agent from the stored pre-waiver base and per-km fees', () => {
    const earnings = service.calculateAgentEarningsSync(
      {
        id: 'order-1',
        base_delivery_fee: 500,
        per_km_delivery_fee: 300,
        currency: 'XAF',
        first_order_delivery_fee_promo: false,
      },
      false,
      config
    );

    expect(earnings.baseDeliveryCommission).toBe(250);
    expect(earnings.perKmDeliveryCommission).toBe(240);
    expect(earnings.totalEarnings).toBe(490);
  });
});
