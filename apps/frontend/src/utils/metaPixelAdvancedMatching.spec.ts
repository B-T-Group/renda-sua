import { buildMetaPixelAdvancedMatching } from './metaPixelAdvancedMatching';

describe('buildMetaPixelAdvancedMatching', () => {
  it('includes hashed-ready geo from the primary address', () => {
    const params = buildMetaPixelAdvancedMatching({
      id: 'user-1',
      email: 'A@B.com',
      last_name: 'Lee',
      country: 'CA',
      addresses: [
        {
          is_primary: true,
          city: 'Toronto',
          state: 'ON',
          postal_code: 'M5V 1A1',
          country: 'CA',
        },
      ],
    });
    expect(params.em).toBe('a@b.com');
    expect(params.ln).toBe('lee');
    expect(params.ct).toBe('toronto');
    expect(params.st).toBe('on');
    expect(params.zp).toBe('m5v1a1');
    expect(params.country).toBe('ca');
  });

  it('uses the first address when none is primary and ignores full country names', () => {
    const params = buildMetaPixelAdvancedMatching({
      id: 'user-2',
      country: 'Cameroon',
      addresses: [
        { city: 'Douala', country: 'Cameroon' },
        { is_primary: false, city: 'Yaounde', country: 'CM' },
      ],
    });
    expect(params.external_id).toBe('user-2');
    expect(params.ct).toBe('douala');
    expect(params.country).toBeUndefined();
    expect(params.em).toBeUndefined();
  });
});
