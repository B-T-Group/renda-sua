import { validateReturnTo } from './returnToValidator';

describe('validateReturnTo', () => {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

  afterAll(() => {
    warnSpy.mockRestore();
  });

  afterEach(() => {
    warnSpy.mockClear();
  });

  it('defaults missing or blank values to /app', () => {
    expect(validateReturnTo()).toBe('/app');
    expect(validateReturnTo('')).toBe('/app');
    expect(validateReturnTo('   ')).toBe('/app');
  });

  it('allows same-origin relative paths with query and fragment', () => {
    expect(validateReturnTo('/app')).toBe('/app');
    expect(validateReturnTo(' /app/orders?id=1#pay ')).toBe(
      '/app/orders?id=1#pay'
    );
  });

  it('falls back to /app for absolute, schemed, and protocol-relative URLs', () => {
    expect(validateReturnTo('https://evil.example/phish')).toBe('/app');
    expect(validateReturnTo('javascript:alert(1)')).toBe('/app');
    expect(validateReturnTo('//evil.example/phish')).toBe('/app');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('falls back to /app for colon, backslash, and other character bypasses', () => {
    expect(validateReturnTo('/javascript:alert(1)')).toBe('/app');
    expect(validateReturnTo('/app\\evil')).toBe('/app');
    expect(validateReturnTo('/app evil')).toBe('/app');
  });
});
