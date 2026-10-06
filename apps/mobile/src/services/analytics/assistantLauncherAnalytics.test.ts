import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackSiteEvent = vi.fn();
vi.mock('./AppEventsService', () => ({ trackSiteEvent: (...args: unknown[]) => trackSiteEvent(...args) }));

import {
  buildLauncherMetadata,
  createImpressionTracker,
  normalizeAssistantLocale,
  trackAttentionPlayed,
  trackLauncherImpression,
  trackLauncherTap,
  trackNudgeDismissed,
  trackNudgeShown,
  type LauncherEventContext,
} from './assistantLauncherAnalytics';

/** Keys allowed by the backend assistant metadata validator (#458). */
const ALLOWED_KEYS = new Set([
  'screen',
  'variant',
  'motion',
  'entry',
  'dismiss_reason',
  'trigger',
  'persona',
  'market',
  'locale',
]);

const client: LauncherEventContext = { persona: 'client', screen: 'ClientBrowse', market: 'cm', language: 'fr-CM', threadId: 't-1' };
const guest: LauncherEventContext = { persona: 'guest', screen: 'GuestBrowse', market: 'CA', language: 'en', threadId: 'thread-9' };

function lastCall() {
  return trackSiteEvent.mock.calls.at(-1)?.[0] as { eventType: string; metadata: Record<string, string>; anonymousId?: string };
}

describe('assistant launcher analytics', () => {
  beforeEach(() => trackSiteEvent.mockClear());

  it('normalises locale to fr | en', () => {
    expect(normalizeAssistantLocale('fr-CM')).toBe('fr');
    expect(normalizeAssistantLocale('FR')).toBe('fr');
    expect(normalizeAssistantLocale('en-US')).toBe('en');
    expect(normalizeAssistantLocale('es')).toBe('en');
    expect(normalizeAssistantLocale(undefined)).toBe('en');
  });

  it('builds validator-safe metadata (screen = route name, ISO-2 market)', () => {
    expect(buildLauncherMetadata(client)).toEqual({ persona: 'client', locale: 'fr', screen: 'ClientBrowse', market: 'CM' });
    const odd = buildLauncherMetadata({ ...client, screen: 'has spaces!', market: 'Cameroon' });
    expect(odd).toEqual({ persona: 'client', locale: 'fr' });
  });

  it('impressions dedupe per session per screen + variant', () => {
    const t = createImpressionTracker();
    expect(t.shouldTrack('ClientBrowse', 'orb')).toBe(true);
    expect(t.shouldTrack('ClientBrowse', 'orb')).toBe(false);
    expect(t.shouldTrack('ClientSearch', 'orb')).toBe(true);
    expect(t.shouldTrack('ClientBrowse', 'header_icon')).toBe(true);
  });

  it('sends each event with only allowed keys', () => {
    trackLauncherImpression({ ...client, screen: 'ClientOrders' }, 'orb', true);
    expect(lastCall().eventType).toBe('assistant.launcher.impression');
    expect(lastCall().metadata).toMatchObject({ variant: 'orb', motion: 'reduced' });
    trackLauncherImpression({ ...client, screen: 'ClientOrders' }, 'orb', true);
    expect(trackSiteEvent).toHaveBeenCalledTimes(1);

    trackLauncherTap(client, 'orb', 'nudge');
    expect(lastCall()).toMatchObject({ eventType: 'assistant.launcher.tap', metadata: { variant: 'orb', entry: 'nudge' } });
    trackLauncherTap(client, undefined, 'menu');
    expect(lastCall().metadata).not.toHaveProperty('variant');
    trackNudgeShown(client);
    expect(lastCall().eventType).toBe('assistant.nudge.shown');
    trackNudgeDismissed(client, 'timeout');
    expect(lastCall().metadata.dismiss_reason).toBe('timeout');
    trackAttentionPlayed(client, 'first_run');
    expect(lastCall()).toMatchObject({ eventType: 'assistant.attention.played', metadata: { trigger: 'first_run' } });

    for (const [input] of trackSiteEvent.mock.calls) {
      for (const key of Object.keys((input as { metadata: object }).metadata)) {
        expect(ALLOWED_KEYS.has(key)).toBe(true);
      }
    }
  });

  it('guests send the thread id as the anonymous id; clients send none', () => {
    trackNudgeShown(guest);
    expect(lastCall().anonymousId).toBe('thread-9');
    trackNudgeShown(client);
    expect(lastCall().anonymousId).toBeUndefined();
  });
});
