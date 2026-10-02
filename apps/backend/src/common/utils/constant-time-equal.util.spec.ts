import { constantTimeEqual } from './constant-time-equal.util';

describe('constantTimeEqual', () => {
  it('matches equal secrets', () => {
    expect(constantTimeEqual('internal-secret', 'internal-secret')).toBe(true);
  });

  it('rejects different secrets, including different lengths and prefixes', () => {
    expect(constantTimeEqual('internal-secreT', 'internal-secret')).toBe(false);
    expect(constantTimeEqual('internal', 'internal-secret')).toBe(false);
    expect(constantTimeEqual('internal-secret-extra', 'internal-secret')).toBe(
      false
    );
    expect(constantTimeEqual('', 'internal-secret')).toBe(false);
  });

  it('rejects missing values without throwing', () => {
    expect(constantTimeEqual(undefined, 'x')).toBe(false);
    expect(constantTimeEqual('x', undefined)).toBe(false);
    expect(constantTimeEqual(null, null)).toBe(false);
  });
});
