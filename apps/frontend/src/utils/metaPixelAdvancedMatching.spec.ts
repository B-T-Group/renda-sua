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
});
