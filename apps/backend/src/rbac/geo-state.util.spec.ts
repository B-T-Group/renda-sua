import { geoStateKey } from './geo-state.util';

describe('geoStateKey', () => {
  it('strips region and province suffixes the same way as the SQL function', () => {
    expect(geoStateKey('Littoral Region Province')).toBe('littoral');
    expect(geoStateKey('Littoral Province')).toBe('littoral');
    expect(geoStateKey('Littoral Region')).toBe('littoral');
    expect(geoStateKey('  Littoral  ')).toBe('littoral');
  });

  it('removes accents and case', () => {
    expect(geoStateKey('Extrême-Nord')).toBe('extreme-nord');
  });
});
