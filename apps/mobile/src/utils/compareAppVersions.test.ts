import { compareAppVersions } from './compareAppVersions';

describe('compareAppVersions', () => {
  it('orders semver-like strings', () => {
    expect(compareAppVersions('1.0.11', '1.0.12')).toBeLessThan(0);
    expect(compareAppVersions('1.0.12', '1.0.12')).toBe(0);
    expect(compareAppVersions('1.1.0', '1.0.99')).toBeGreaterThan(0);
    expect(compareAppVersions('v1.0.10', '1.0.9')).toBeGreaterThan(0);
  });
});
