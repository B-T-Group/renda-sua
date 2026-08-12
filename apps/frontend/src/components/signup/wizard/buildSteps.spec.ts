import { buildSteps } from './buildSteps';
import type { PersonaId } from './types';

describe('buildSteps', () => {
  const cases: Array<{
    personas: PersonaId[];
    expectStore: boolean;
    expectFocus?: boolean;
  }> = [
    { personas: ['client'], expectStore: false },
    { personas: ['agent'], expectStore: false, expectFocus: true },
    { personas: ['business'], expectStore: true },
    { personas: ['client', 'business'], expectStore: true },
    { personas: ['agent', 'business'], expectStore: true, expectFocus: true },
    { personas: ['client', 'agent'], expectStore: false, expectFocus: true },
    {
      personas: ['client', 'agent', 'business'],
      expectStore: true,
      expectFocus: true,
    },
  ];

  it.each(cases)(
    'personas $personas → storeLocation=$expectStore',
    ({ personas, expectStore, expectFocus }) => {
      const steps = buildSteps({ personas, country: 'CA' });
      const ids = steps.map((s) => s.id);
      expect(ids[0]).toBe('country');
      expect(ids.indexOf('country')).toBeLessThan(ids.indexOf('contact'));
      expect(ids).toContain('personas');
      expect(ids).toContain('contact');
      expect(ids).toContain('review');
      expect(ids.includes('storeLocation')).toBe(expectStore);
      expect(ids.includes('agentFocus')).toBe(Boolean(expectFocus));
      if (expectStore) {
        expect(ids.indexOf('storeLocation')).toBeGreaterThan(
          ids.indexOf('personas')
        );
        expect(ids.indexOf('storeLocation')).toBeLessThan(ids.indexOf('review'));
      }
    }
  );
});
