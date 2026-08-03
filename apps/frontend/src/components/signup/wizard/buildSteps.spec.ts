import { buildSteps } from './buildSteps';
import type { PersonaId } from './types';

describe('buildSteps', () => {
  const cases: Array<{ personas: PersonaId[]; expectStore: boolean }> = [
    { personas: ['client'], expectStore: false },
    { personas: ['agent'], expectStore: false },
    { personas: ['business'], expectStore: true },
    { personas: ['client', 'business'], expectStore: true },
    { personas: ['agent', 'business'], expectStore: true },
    { personas: ['client', 'agent'], expectStore: false },
    { personas: ['client', 'agent', 'business'], expectStore: true },
  ];

  it.each(cases)(
    'personas $personas → storeLocation=$expectStore',
    ({ personas, expectStore }) => {
      const steps = buildSteps({ personas, country: 'CA' });
      const ids = steps.map((s) => s.id);
      expect(ids[0]).toBe('contact');
      expect(ids).toContain('personas');
      expect(ids).toContain('country');
      expect(ids).toContain('review');
      expect(ids.includes('storeLocation')).toBe(expectStore);
      if (expectStore) {
        expect(ids.indexOf('storeLocation')).toBeGreaterThan(
          ids.indexOf('country')
        );
        expect(ids.indexOf('storeLocation')).toBeLessThan(ids.indexOf('review'));
      }
    }
  );
});
