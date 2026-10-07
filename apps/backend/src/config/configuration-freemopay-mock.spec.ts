import configuration from './configuration';
import { isProductionRuntime } from '../auth/test-user-bypass.util';

jest.mock('../auth/test-user-bypass.util', () => ({
  isProductionRuntime: jest.fn(),
  parseTestAllowlist: jest.fn(() => []),
}));

describe('Configuration - FreemoPay Mock Production Safety', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should enable mock when flag is true and runtime is not production', () => {
    process.env.FREEMOPAY_AMOUNT_MOCK = 'true';
    process.env.NODE_ENV = 'development';
    (isProductionRuntime as jest.Mock).mockReturnValue(false);

    const config = configuration();

    expect(config.freemopay.amountMockEnabled).toBe(true);
  });

  it('should NOT enable mock when flag is true but runtime is production (NODE_ENV)', () => {
    process.env.FREEMOPAY_AMOUNT_MOCK = 'true';
    process.env.NODE_ENV = 'production';
    (isProductionRuntime as jest.Mock).mockReturnValue(true);

    const config = configuration();

    expect(config.freemopay.amountMockEnabled).toBe(false);
  });

  it('should NOT enable mock when flag is true but runtime is production (DEPLOYMENT_ENV)', () => {
    process.env.FREEMOPAY_AMOUNT_MOCK = 'true';
    process.env.NODE_ENV = 'development';
    process.env.DEPLOYMENT_ENV = 'production';
    (isProductionRuntime as jest.Mock).mockReturnValue(true);

    const config = configuration();

    expect(config.freemopay.amountMockEnabled).toBe(false);
  });

  it('should NOT enable mock when flag is false even in development', () => {
    process.env.FREEMOPAY_AMOUNT_MOCK = 'false';
    process.env.NODE_ENV = 'development';
    (isProductionRuntime as jest.Mock).mockReturnValue(false);

    const config = configuration();

    expect(config.freemopay.amountMockEnabled).toBe(false);
  });

  it('should NOT enable mock when flag is not set', () => {
    delete process.env.FREEMOPAY_AMOUNT_MOCK;
    process.env.NODE_ENV = 'development';
    (isProductionRuntime as jest.Mock).mockReturnValue(false);

    const config = configuration();

    expect(config.freemopay.amountMockEnabled).toBe(false);
  });

  it('should NOT enable mock when flag is any value other than "true"', () => {
    const invalidValues = ['1', 'yes', 'enabled', 'TRUE', 'True'];

    invalidValues.forEach((value) => {
      process.env.FREEMOPAY_AMOUNT_MOCK = value;
      process.env.NODE_ENV = 'development';
      (isProductionRuntime as jest.Mock).mockReturnValue(false);

      const config = configuration();

      expect(config.freemopay.amountMockEnabled).toBe(false);
    });
  });

  it('should have the correct default FreemoPay config', () => {
    delete process.env.FREEMOPAY_AMOUNT_MOCK;
    delete process.env.FREEMOPAY_CALLBACK_URL;
    process.env.NODE_ENV = 'development';
    (isProductionRuntime as jest.Mock).mockReturnValue(false);

    const config = configuration();

    expect(config.freemopay.baseUrl).toBe('https://api-v2.freemopay.com');
    expect(config.freemopay.appKey).toBe('5b084323-3fff-47e4-bbcb-a1970efe3051');
    expect(config.freemopay.amountMockEnabled).toBe(false);
  });
});
