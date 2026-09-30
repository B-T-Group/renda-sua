import { matchRegionName } from './matchMapRegion';

describe('matchRegionName', () => {
  const regions = ['Centre', 'Littoral Region', 'Ouest Region'];

  it('matches the current market state to a region name', () => {
    expect(matchRegionName(regions, 'Littoral')).toBe('Littoral Region');
  });

  it('returns null when the state is not in the list', () => {
    expect(matchRegionName(regions, 'Estuaire')).toBeNull();
  });
});
