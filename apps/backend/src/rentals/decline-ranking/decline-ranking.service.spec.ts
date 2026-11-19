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
    expect(flags.declineRankingEnabled).toHaveBeenCalledWith(null);
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

  it('looks up the flag with the normalized country code', async () => {
    flags.declineRankingEnabled.mockResolvedValue(false);
    await service.multipliersFor(['busy'], ' cm ');
    expect(flags.declineRankingEnabled).toHaveBeenCalledWith('CM');
    expect(flags.declineRankingEnabled).not.toHaveBeenCalledWith(' cm ');
  });

  it('uses a country weight and falls back to the global row', async () => {
    flags.declineRankingEnabled.mockResolvedValue(true);
    hasura.executeQuery.mockResolvedValue({
      application_configurations: [
        { config_key: 'rentals_decline_rank_weight', number_value: 0, country_code: null },
        { config_key: 'rentals_decline_rank_weight', number_value: 0.3, country_code: 'CM' },
      ],
      rental_condition_decline_counts_90d: [{ party_id: 'busy', decline_count: 7 }],
      rental_business_pickup_reach_90d: [{ business_id: 'busy', pickups_reached: 10 }],
    });
    const cameroon = await service.multipliersFor(['busy'], 'CM');
    const gabon = await service.multipliersFor(['busy'], 'GA');
    expect(cameroon.get('busy')).toBeLessThan(1);
    expect(gabon.size).toBe(0);
    expect(hasura.executeQuery).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ country: 'CM' }));
    expect(hasura.executeQuery).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ country: 'GA' }));
  });

  it('does not keep a failed snapshot', async () => {
    flags.declineRankingEnabled.mockResolvedValue(true);
    hasura.executeQuery.mockRejectedValueOnce(new Error('snapshot')).mockResolvedValueOnce({
      application_configurations: [],
      rental_condition_decline_counts_90d: [{ party_id: 'busy', decline_count: 7 }],
      rental_business_pickup_reach_90d: [{ business_id: 'busy', pickups_reached: 10 }],
    });
    await expect(service.multipliersFor(['busy'], 'CM')).rejects.toThrow('snapshot');
    const second = await service.multipliersFor(['busy'], 'CM');
    expect(second.get('busy')).toBeLessThan(1);
    expect(hasura.executeQuery).toHaveBeenCalledTimes(2);
  });

  it('keeps one cache per country', async () => {
    flags.declineRankingEnabled.mockImplementation(async (country?: string) => country === 'CM');
    hasura.executeQuery.mockResolvedValue({
      application_configurations: [],
      rental_condition_decline_counts_90d: [{ party_id: 'busy', decline_count: 7 }],
      rental_business_pickup_reach_90d: [{ business_id: 'busy', pickups_reached: 10 }],
    });
    const gabon = await service.multipliersFor(['busy'], 'GA');
    const cameroon = await service.multipliersFor(['busy'], 'CM');
    expect(gabon.size).toBe(0);
    expect(cameroon.get('busy')).toBeLessThan(1);
    expect(flags.declineRankingEnabled).toHaveBeenNthCalledWith(1, 'GA');
    expect(flags.declineRankingEnabled).toHaveBeenNthCalledWith(2, 'CM');
  });
});
