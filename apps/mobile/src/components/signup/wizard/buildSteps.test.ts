import { describe, expect, it } from 'vitest';
import { buildSteps } from './buildSteps';

describe('buildSteps', () => {
  it('includes storeLocation only when business is selected', () => {
    const withoutBiz = buildSteps({ personas: ['client'] }).map((s) => s.id);
    expect(withoutBiz).toEqual(['country', 'contact', 'personas', 'review']);
    const withAgent = buildSteps({ personas: ['agent'] }).map((s) => s.id);
    expect(withAgent).toEqual([
      'country',
      'contact',
      'personas',
      'agentFocus',
      'review',
    ]);

    const withBiz = buildSteps({ personas: ['business'] }).map((s) => s.id);
    expect(withBiz).toEqual([
      'country',
      'contact',
      'personas',
      'storeLocation',
      'review',
    ]);
  });

  it('places country before contact so phone rules can follow market', () => {
    const ids = buildSteps({ personas: ['business'] }).map((s) => s.id);
    expect(ids.indexOf('country')).toBeLessThan(ids.indexOf('contact'));
  });

  it('includes storeLocation for multi-persona including business', () => {
    const ids = buildSteps({ personas: ['client', 'agent', 'business'] }).map(
      (s) => s.id
    );
    expect(ids).toContain('storeLocation');
  });
});
