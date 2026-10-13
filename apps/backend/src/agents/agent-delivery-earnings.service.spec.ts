import { AgentDeliveryEarningsService } from './agent-delivery-earnings.service';
import { periodBounds } from './agent-delivery-earnings.mapper';

describe('AgentDeliveryEarningsService', () => {
  const hasura = { executeQuery: jest.fn() };
  const delivery = {
    getTimezone: jest.fn(),
    getNormalDeliveryBaseFee: jest.fn(),
    getFastDeliveryBaseFee: jest.fn(),
    getPerKmDeliveryFee: jest.fn(),
  };
  const commissions = { getCommissionConfigs: jest.fn() };
  const service = new AgentDeliveryEarningsService(
    hasura as never,
    delivery as never,
    commissions as never
  );

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-12T15:00:00.000Z'));
    jest.clearAllMocks();
    delivery.getTimezone.mockResolvedValue('America/Toronto');
    delivery.getNormalDeliveryBaseFee.mockResolvedValue(500);
    delivery.getFastDeliveryBaseFee.mockResolvedValue(1500);
    delivery.getPerKmDeliveryFee.mockResolvedValue(100);
    commissions.getCommissionConfigs.mockResolvedValue({
      verifiedAgentBaseDeliveryCommission: 80,
      verifiedAgentPerKmDeliveryCommission: 80,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses UTC and the all-time query when the agent has no country', async () => {
    hasura.executeQuery.mockResolvedValue({
      commission_payouts: [
        payout('400', 'order-1'),
        payout('999', ''),
      ],
    });
    const actual = await service.getEarnings({
      userId: 'user-1',
      country: '  ',
      period: 'all',
    });
    expect(delivery.getTimezone).not.toHaveBeenCalled();
    expect(delivery.getNormalDeliveryBaseFee).toHaveBeenCalledWith('XX');
    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('query AgentDeliveryPayouts'),
      { userId: 'user-1', currency: 'XAF' }
    );
    expect(String(hasura.executeQuery.mock.calls[0][0])).not.toContain('InWindow');
    expect(actual.currency).toBe('XAF');
    expect(actual.earnedAmount).toBe(400);
    expect(actual.tripCount).toBe(1);
  });

  it('loads a calendar month in the country currency and ignores a bad amount', async () => {
    hasura.executeQuery.mockResolvedValue({
      commission_payouts: [payout('80', 'order-1'), payout('nope', 'order-1')],
    });
    const actual = await service.getEarnings({
      userId: 'user-1',
      country: 'ca',
      period: 'month',
    });
    const now = new Date('2026-10-12T15:00:00.000Z');
    const bounds = periodBounds('month', now, 'America/Toronto');
    expect(delivery.getTimezone).toHaveBeenCalledWith('ca');
    expect(delivery.getNormalDeliveryBaseFee).toHaveBeenCalledWith('CA');
    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('AgentDeliveryPayoutsInWindow'),
      { userId: 'user-1', currency: 'CAD', start: bounds.start, end: bounds.end }
    );
    expect(actual.currency).toBe('CAD');
    expect(actual.pay).toEqual({ baseAmount: 400, fastBaseAmount: 1200, perKmAmount: 80 });
    expect(actual.earnedAmount).toBe(80);
    expect(actual.trips[0].amount).toBe(80);
  });
});

function payout(amount: string, orderId: string) {
  return {
    amount,
    commission_type: 'base_delivery_fee',
    created_at: '2026-10-11T10:00:00.000Z',
    order: orderId
      ? { id: orderId, order_number: '1001', actual_delivery_time: '2026-10-11T10:00:00.000Z' }
      : null,
  };
}
