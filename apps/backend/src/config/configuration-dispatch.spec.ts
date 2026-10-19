import { Logger } from '@nestjs/common';
import configuration from './configuration';

describe('Configuration - dispatch radius and GPS cutoff', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OFFER_ROUND1_RADIUS_KM;
    delete process.env.OFFER_ROUND2_RADIUS_KM;
    delete process.env.AGENT_LOCATION_MAX_AGE_MINUTES;
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => {
    process.env = originalEnv;
  });

  it('defaults: no widening and no GPS cutoff unless configured', () => {
    const config = configuration();
    expect(config.orderOffers.round1RadiusKm).toBeNull();
    expect(config.orderOffers.round2RadiusKm).toBeNull();
    expect(config.deliveryAvailability.agentLocationMaxAgeMinutes).toBe(0);
  });

  it('DEV env file opts in to the 20 km round 2 but holds the GPS cutoff off (web has no heartbeat); prod sets neither', () => {
    const fs = jest.requireActual<typeof import('fs')>('fs');
    const path = jest.requireActual<typeof import('path')>('path');
    const read = (name: string) =>
      fs.readFileSync(path.resolve(__dirname, '../..', name), 'utf8');
    const dev = read('.env.development');
    const prod = read('.env.production');
    expect(dev).toMatch(/^OFFER_ROUND2_RADIUS_KM=20$/m);
    expect(dev).toMatch(/^AGENT_LOCATION_MAX_AGE_MINUTES=0$/m);
    expect(prod).not.toMatch(/^OFFER_ROUND2_RADIUS_KM=/m);
    expect(prod).not.toMatch(/^AGENT_LOCATION_MAX_AGE_MINUTES=/m);
  });

  it('reads the env overrides', () => {
    process.env.OFFER_ROUND1_RADIUS_KM = '8';
    process.env.OFFER_ROUND2_RADIUS_KM = '15';
    process.env.AGENT_LOCATION_MAX_AGE_MINUTES = '30';
    const config = configuration();
    expect(config.orderOffers.round1RadiusKm).toBe(8);
    expect(config.orderOffers.round2RadiusKm).toBe(15);
    expect(config.deliveryAvailability.agentLocationMaxAgeMinutes).toBe(30);
  });

  it('ignores invalid values', () => {
    process.env.OFFER_ROUND1_RADIUS_KM = 'abc';
    process.env.OFFER_ROUND2_RADIUS_KM = '-1';
    process.env.AGENT_LOCATION_MAX_AGE_MINUTES = '-5';
    const config = configuration();
    expect(config.orderOffers.round1RadiusKm).toBeNull();
    expect(config.orderOffers.round2RadiusKm).toBeNull();
    expect(config.deliveryAvailability.agentLocationMaxAgeMinutes).toBe(0);
  });

  it('warns once per env value that is set but cannot be parsed, naming it', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    process.env.OFFER_ROUND1_RADIUS_KM = 'abc';
    process.env.OFFER_ROUND2_RADIUS_KM = '-1';
    process.env.AGENT_LOCATION_MAX_AGE_MINUTES = '30m';
    const config = configuration();
    expect(config.deliveryAvailability.agentLocationMaxAgeMinutes).toBe(0);
    const lines = warn.mock.calls.map((c) => String(c[0]));
    expect(lines.filter((l) => l.startsWith('OFFER_ROUND1_RADIUS_KM="abc"'))).toHaveLength(1);
    expect(lines.filter((l) => l.startsWith('OFFER_ROUND2_RADIUS_KM="-1"'))).toHaveLength(1);
    expect(lines.filter((l) => l.startsWith('AGENT_LOCATION_MAX_AGE_MINUTES="30m"'))).toEqual([
      'AGENT_LOCATION_MAX_AGE_MINUTES="30m" cannot be parsed; using 0',
    ]);
  });

  it('does not warn for unset, blank or valid values', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    process.env.OFFER_ROUND2_RADIUS_KM = ' ';
    process.env.AGENT_LOCATION_MAX_AGE_MINUTES = '30';
    configuration();
    const lines = warn.mock.calls.map((c) => String(c[0]));
    expect(lines.filter((l) => /OFFER_ROUND|AGENT_LOCATION_MAX_AGE/.test(l))).toEqual([]);
  });
});
