import { DeclineRankingService } from './decline-ranking.service';

describe('DeclineRankingService', () => {
  const flags = { declineRankingEnabled: jest.fn() };
  const hasura = { executeQuery: jest.fn() };
  const service = new DeclineRankingService(hasura as any, flags as any);

  beforeEach(() => {
    jest.clearAllMocks();
    service.clearCache();
  });

  it('leaves ranking unchanged when the flag is off', async () => {
    flags.declineRankingEnabled.mockResolvedValue(false);
    const result = await service.multipliersFor(['biz']);
    expect(result.size).toBe(0);
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });

  it('penalizes a business past the sample and leaves a small sample alone', async () => {
    flags.declineRankingEnabled.mockResolvedValue(true);
    hasura.executeQuery.mockResolvedValue({
      application_configurations: [],
      rental_condition_decline_counts_90d: [
        { party_id: 'busy', decline_count: 7 },
        { party_id: 'new', decline_count: 4 },
      ],
      rental_business_pickup_reach_90d: [
        { business_id: 'busy', pickups_reached: 10 },
        { business_id: 'new', pickups_reached: 4 },
      ],
    });
    const result = await service.multipliersFor(['busy', 'new', 'clean']);
    expect(result.get('busy')).toBeLessThan(1);
    expect(result.has('new')).toBe(false);
    expect(result.has('clean')).toBe(false);
    expect(flags.declineRankingEnabled).toHaveBeenCalledWith(undefined);
  });

  it('caps declines at pickups reached and ignores a weight of 1', async () => {
    flags.declineRankingEnabled.mockResolvedValue(true);
    const warn = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    hasura.executeQuery.mockResolvedValue({
      application_configurations: [{ config_key: 'rentals_decline_rank_weight', number_value: null }],
      rental_condition_decline_counts_90d: [{ party_id: 'busy', decline_count: 40 }],
      rental_business_pickup_reach_90d: [{ business_id: 'busy', pickups_reached: 12 }],
    });
    const result = await service.multipliersFor(['busy'], 'CM');
    expect(flags.declineRankingEnabled).toHaveBeenCalledWith('CM');
    expect(result.get('busy')).toBeLessThan(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
