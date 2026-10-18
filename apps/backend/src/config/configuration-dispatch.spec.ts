import configuration from './configuration';

describe('Configuration - dispatch radius and GPS cutoff', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OFFER_ROUND1_RADIUS_KM;
    delete process.env.OFFER_ROUND2_RADIUS_KM;
    delete process.env.AGENT_LOCATION_MAX_AGE_MINUTES;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('defaults: round 1 follows the country radius, round 2 is 20 km, GPS cutoff 30 min', () => {
    const config = configuration();
    expect(config.orderOffers.round1RadiusKm).toBeNull();
    expect(config.orderOffers.round2RadiusKm).toBe(20);
    expect(config.deliveryAvailability.agentLocationMaxAgeMinutes).toBe(30);
  });

  it('reads the env overrides', () => {
    process.env.OFFER_ROUND1_RADIUS_KM = '8';
    process.env.OFFER_ROUND2_RADIUS_KM = '15';
    process.env.AGENT_LOCATION_MAX_AGE_MINUTES = '0';
    const config = configuration();
    expect(config.orderOffers.round1RadiusKm).toBe(8);
    expect(config.orderOffers.round2RadiusKm).toBe(15);
    expect(config.deliveryAvailability.agentLocationMaxAgeMinutes).toBe(0);
  });

  it('ignores invalid values', () => {
    process.env.OFFER_ROUND1_RADIUS_KM = 'abc';
    process.env.AGENT_LOCATION_MAX_AGE_MINUTES = '-5';
    const config = configuration();
    expect(config.orderOffers.round1RadiusKm).toBeNull();
    expect(config.deliveryAvailability.agentLocationMaxAgeMinutes).toBe(30);
  });
});
