import { resolveMetaActionSource } from './resolve-meta-action-source.util';

describe('resolveMetaActionSource', () => {
  it.each(['ios', 'android', 'mobile', 'app', 'IOS', ' Android '])(
    'maps %p to app',
    (platform) => {
      expect(resolveMetaActionSource(platform)).toBe('app');
    }
  );

  it.each(['web', 'website', 'WEB', '', null, undefined, 'desktop'])(
    'maps %p to website',
    (platform) => {
      expect(resolveMetaActionSource(platform as string | null | undefined)).toBe(
        'website'
      );
    }
  );
});
