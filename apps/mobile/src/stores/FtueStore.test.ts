import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../services/storage/StorageService', () => ({
  default: {
    getObject: vi.fn(async () => null),
    setObject: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  },
}));

vi.mock('../utils/ftueExperiments', () => ({
  resolveSkipTimingVariant: vi.fn(async () => 'immediate'),
}));

import { FtueStore } from './FtueStore';
import { ONBOARDING_VERSION } from '../constants/onboarding';

describe('FtueStore', () => {
  let store: FtueStore;

  beforeEach(() => {
    store = new FtueStore();
  });

  it('shows onboarding before hydrate completes as false', () => {
    expect(store.shouldShowOnboarding).toBe(false);
  });

  it('shows onboarding after hydrate with empty state', async () => {
    await store.hydrate();
    expect(store.shouldShowOnboarding).toBe(true);
  });

  it('hides onboarding after completion', async () => {
    await store.hydrate();
    await store.completeOnboarding('completed', 'buy');
    expect(store.shouldShowOnboarding).toBe(false);
    expect(store.completedVersion).toBe(ONBOARDING_VERSION);
    expect(store.personaIntent).toBe('buy');
  });

  it('markCompletedIfNeeded only completes never-finished onboarding', async () => {
    await store.hydrate();
    await store.markCompletedIfNeeded();
    expect(store.completedVersion).toBe(ONBOARDING_VERSION);

    store.completedVersion = ONBOARDING_VERSION - 1;
    await store.markCompletedIfNeeded();
    expect(store.completedVersion).toBe(ONBOARDING_VERSION - 1);
  });

  it('records product views', async () => {
    await store.hydrate();
    await store.recordProductView();
    await store.recordProductView();
    expect(store.browseCounters.productViews).toBe(2);
    expect(store.browseCounters.sessionProductViews).toBe(2);
  });

  it('respects nudge dismissal cooldown', async () => {
    await store.hydrate();
    expect(store.isNudgeEligible('sell-here')).toBe(true);
    await store.dismissNudge('sell-here');
    expect(store.isNudgeEligible('sell-here')).toBe(false);
  });
});
