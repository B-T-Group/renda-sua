import {
  ensureMetaFbc,
  getMetaBrowserContext,
  getMetaFbp,
} from './metaBrowserIds';

describe('metaBrowserIds', () => {
  const originalCookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');

  beforeEach(() => {
    let jar = '';
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => jar,
      set: (value: string) => {
        const [pair] = value.split(';');
        const eq = pair.indexOf('=');
        const name = pair.slice(0, eq);
        const rest = jar
          .split(';')
          .map((p) => p.trim())
          .filter((p) => p && !p.startsWith(`${name}=`));
        rest.push(pair.trim());
        jar = rest.join('; ');
      },
    });
    window.history.replaceState({}, '', '/shop');
  });

  afterEach(() => {
    if (originalCookie) {
      Object.defineProperty(Document.prototype, 'cookie', originalCookie);
    }
  });

  it('returns existing _fbc cookie without rewriting', () => {
    document.cookie = '_fbc=fb.1.100.existing';
    expect(ensureMetaFbc()).toBe('fb.1.100.existing');
  });

  it('constructs and persists _fbc from fbclid query param', () => {
    window.history.replaceState({}, '', '/shop?fbclid=click123');
    const fbc = ensureMetaFbc();
    expect(fbc).toMatch(/^fb\.1\.\d+\.click123$/);
    expect(document.cookie).toContain('_fbc=');
    expect(getMetaFbp()).toBeUndefined();
  });

  it('returns browser context with fbp and event source url', () => {
    document.cookie = '_fbp=fb.1.200.browser';
    document.cookie = '_fbc=fb.1.200.click';
    window.history.replaceState({}, '', '/item/1');

    expect(getMetaBrowserContext()).toEqual({
      fbc: 'fb.1.200.click',
      fbp: 'fb.1.200.browser',
      eventSourceUrl: window.location.href,
    });
  });
});
