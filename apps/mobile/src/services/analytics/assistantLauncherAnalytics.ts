/**
 * Launcher / nudge / attention events (#451 eng plan §3.3, spec §4). Metadata
 * keys and values match the backend assistant validators from #458
 * (site-event-metadata.util.ts): enums only, no PII, `screen` = route name,
 * `locale` = fr | en, `market` = ISO-2.
 */
import { trackSiteEvent } from './AppEventsService';
import type { AttentionTrigger, LauncherPersona, NudgeDismissReason } from '../../utils/assistantLauncher';

export type LauncherVariant = 'orb' | 'orb_extended' | 'header_icon';
export type LauncherEntry = 'orb' | 'header_icon' | 'menu' | 'nudge';

export type LauncherEventContext = {
  persona: LauncherPersona;
  screen: string;
  market?: string | null;
  language?: string | null;
  /** Guest events carry the chat thread id, never the per-install anon id. */
  threadId?: string | null;
};

export function normalizeAssistantLocale(language: string | null | undefined): 'fr' | 'en' {
  return (language ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

const SCREEN_PATTERN = /^[A-Za-z0-9_.-]{1,40}$/;

export function buildLauncherMetadata(
  ctx: LauncherEventContext,
  extra: Record<string, string> = {}
): Record<string, string> {
  const meta: Record<string, string> = {
    persona: ctx.persona,
    locale: normalizeAssistantLocale(ctx.language),
  };
  if (SCREEN_PATTERN.test(ctx.screen)) meta.screen = ctx.screen;
  const market = (ctx.market ?? '').toUpperCase();
  if (/^[A-Z]{2}$/.test(market)) meta.market = market;
  return { ...meta, ...extra };
}

function send(eventType: string, ctx: LauncherEventContext, extra: Record<string, string>) {
  trackSiteEvent({
    eventType,
    metadata: buildLauncherMetadata(ctx, extra),
    anonymousId: ctx.persona === 'guest' ? ctx.threadId ?? undefined : undefined,
  });
}

/** Once per app session per screen (+ variant). */
export function createImpressionTracker() {
  const seen = new Set<string>();
  return {
    shouldTrack(screen: string, variant: LauncherVariant): boolean {
      const key = `${screen}:${variant}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
  };
}

const sessionImpressions = createImpressionTracker();

export function trackLauncherImpression(
  ctx: LauncherEventContext,
  variant: LauncherVariant,
  reducedMotion: boolean
): void {
  if (!sessionImpressions.shouldTrack(ctx.screen, variant)) return;
  send('assistant.launcher.impression', ctx, { variant, motion: reducedMotion ? 'reduced' : 'on' });
}

/** `variant` is the surface tapped; a menu-row tap has none. */
export function trackLauncherTap(
  ctx: LauncherEventContext,
  variant: LauncherVariant | undefined,
  entry: LauncherEntry
): void {
  send('assistant.launcher.tap', ctx, variant ? { variant, entry } : { entry });
}

export function trackNudgeShown(ctx: LauncherEventContext): void {
  send('assistant.nudge.shown', ctx, {});
}

export function trackNudgeDismissed(ctx: LauncherEventContext, reason: NudgeDismissReason): void {
  send('assistant.nudge.dismissed', ctx, { dismiss_reason: reason });
}

export function trackAttentionPlayed(ctx: LauncherEventContext, trigger: AttentionTrigger): void {
  send('assistant.attention.played', ctx, { trigger });
}
