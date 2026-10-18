import { resolveDispatchRadiusKm } from './dispatch-radius.util';

describe('resolveDispatchRadiusKm', () => {
  it('round 1 uses round1RadiusKm when set', () => {
    expect(
      resolveDispatchRadiusKm({
        round: 1,
        countryRadiusKm: 5,
        round1RadiusKm: 8,
        round2RadiusKm: 20,
      })
    ).toBe(8);
  });

  it('round 1 falls back to the country radius when round1RadiusKm is unset or invalid', () => {
    for (const round1RadiusKm of [null, undefined, 0, -3, Number.NaN]) {
      expect(
        resolveDispatchRadiusKm({
          round: 1,
          countryRadiusKm: 5,
          round1RadiusKm,
          round2RadiusKm: 20,
        })
      ).toBe(5);
    }
  });

  it('round 2 uses round2RadiusKm', () => {
    expect(
      resolveDispatchRadiusKm({
        round: 2,
        countryRadiusKm: 5,
        round1RadiusKm: null,
        round2RadiusKm: 20,
      })
    ).toBe(20);
  });

  it('round 2 is never narrower than round 1', () => {
    expect(
      resolveDispatchRadiusKm({
        round: 2,
        countryRadiusKm: 5,
        round1RadiusKm: 8,
        round2RadiusKm: 3,
      })
    ).toBe(8);
    expect(
      resolveDispatchRadiusKm({
        round: 2,
        countryRadiusKm: 5,
        round1RadiusKm: null,
        round2RadiusKm: null,
      })
    ).toBe(5);
  });
});
