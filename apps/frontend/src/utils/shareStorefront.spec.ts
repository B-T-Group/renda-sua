import { shareStorefront } from './shareStorefront';

describe('shareStorefront', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://rendasua.com' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('uses navigator.share when available', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    });
    const result = await shareStorefront({
      businessId: 'b1',
      name: 'Shop',
      shareMessage: 'Check out Shop on Rendasua: https://rendasua.com/store/b1',
    });
    expect(result).toBe('shared');
    expect(share).toHaveBeenCalled();
  });

  it('falls back to clipboard', async () => {
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
    });
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const result = await shareStorefront({
      businessId: 'b1',
      name: 'Shop',
      shareMessage: 'Check out Shop',
    });
    expect(result).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://rendasua.com/store/b1');
  });
});
