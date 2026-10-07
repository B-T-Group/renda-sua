import { Box, ButtonBase, Typography } from '@mui/material';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  SITE_EVENT_ASSISTANT_ATTENTION_PLAYED,
  SITE_EVENT_ASSISTANT_LAUNCHER_IMPRESSION,
  SITE_EVENT_ASSISTANT_LAUNCHER_TAP,
  SITE_EVENT_ASSISTANT_NUDGE_DISMISSED,
  SITE_EVENT_ASSISTANT_NUDGE_SHOWN,
} from '../../hooks/useTrackSiteEvent';
import { brandTokens } from '../../theme/brandTokens';
import { zIndex } from '../../theme/themeUtils';
import {
  AssistantLauncherNudge,
  NudgeDismissReason,
} from './AssistantLauncherNudge';
import {
  EXTENDED_LABEL_SESSIONS,
  canPlayAttention,
  claimImpression,
  hasSeenNudge,
  launcherSessionNumber,
  markNudgeSeen,
  recordAttention,
} from './launcherStorage';
import { RendaCharacter } from './RendaCharacter';
import type { RendaState } from './rendaCharacterEngine';
import { useAssistantLauncherAnalytics } from './useAssistantLauncherAnalytics';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** First-run nudge waits for 3 s of dwell on browse home. */
export const NUDGE_DWELL_MS = 3000;
/** Attention waits for 2 s of scroll idle. */
export const ATTENTION_SCROLL_IDLE_MS = 2000;
/** Ripple + pop ≤ 1.6 s. */
export const ATTENTION_MS = 1600;
/** Screen-reader-only text (kept in the a11y tree, off screen). */
const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  border: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;
/** Attentive → Idle 150 ms after pointer leave / blur / press-out. */
const ATTENTIVE_EXIT_MS = 150;

export type AttentionTrigger =
  | 'first_run'
  | 'zero_results'
  | 'reorder_eligible';
export const ASSISTANT_ATTENTION_EVENT = 'rendasua:assistant-attention';

/** Ask the launcher for a (capped) attention ripple, e.g. 0 search results + 3 s idle. */
export function requestAssistantAttention(
  trigger: Exclude<AttentionTrigger, 'first_run'>
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(ASSISTANT_ATTENTION_EVENT, { detail: { trigger } })
  );
}

/** On web, an on-screen keyboard: a focused text field or a visualViewport shrink > 150 px. */
function useKeyboardOpen(enabled: boolean): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setOpen(false);
      return undefined;
    }
    const isField = (el: Element | null) =>
      !!el &&
      (el.tagName === 'TEXTAREA' ||
        (el.tagName === 'INPUT' &&
          ![
            'button',
            'checkbox',
            'radio',
            'submit',
            'range',
            'color',
            'file',
          ].includes((el as HTMLInputElement).type)) ||
        (el as HTMLElement).isContentEditable);
    const vv = window.visualViewport;
    const update = () => {
      const shrunk = !!vv && window.innerHeight - vv.height > 150;
      setOpen(isField(document.activeElement) || shrunk);
    };
    const onFocusOut = () => window.setTimeout(update, 0);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', onFocusOut);
    vv?.addEventListener('resize', update);
    update();
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', onFocusOut);
      vv?.removeEventListener('resize', update);
    };
  }, [enabled]);
  return open;
}

export interface AssistantLauncherProps {
  isMobile: boolean;
  /** Mobile bottom offset (92 with the client/guest bottom nav, else 24). */
  bottomOffset: number;
  /** Route name for analytics (`home`, `items`, `store_detail` …). */
  screen: string;
  isSignedIn: boolean;
}

/**
 * Floating assistant launcher (spec #451 §1, behind `assistant_launcher_v1`):
 * a 52 px Renda character in a 56 px tap target, the first-run nudge and the
 * capped attention ripple.
 */
export function AssistantLauncher({
  isMobile,
  bottomOffset,
  screen,
  isSignedIn,
}: AssistantLauncherProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const reducedMotion = usePrefersReducedMotion();
  const track = useAssistantLauncherAnalytics(isSignedIn);
  const hintId = `assistant-launcher-hint-${useId().replace(
    /[^a-zA-Z0-9_-]/g,
    ''
  )}`;
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [engaged, setEngaged] = useState(false);
  const engageTimer = useRef<number | null>(null);
  const [attention, setAttention] = useState(false);
  const [extended, setExtended] = useState(
    () => launcherSessionNumber() <= EXTENDED_LABEL_SESSIONS
  );
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const keyboardOpen = useKeyboardOpen(isMobile);
  const lastScrollRef = useRef(0);
  const attentionTimers = useRef<number[]>([]);

  const variant = extended ? 'orb_extended' : 'orb';
  const motion = reducedMotion ? 'reduced' : 'on';
  const hidden = keyboardOpen;

  // Collapse the extended label on the first scroll; remember scroll time for attention.
  useEffect(() => {
    const onScroll = () => {
      lastScrollRef.current = Date.now();
      setExtended(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Impression: once per app session per screen, while actually visible.
  useEffect(() => {
    if (hidden) return;
    if (claimImpression(screen)) {
      track(SITE_EVENT_ASSISTANT_LAUNCHER_IMPRESSION, {
        screen,
        variant,
        motion,
      });
    }
    // variant/motion describe the first render on this screen only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, hidden]);

  const playAttention = useCallback(
    (trigger: AttentionTrigger) => {
      // Reduce motion: no ripple (and nothing is counted against the caps).
      if (reducedMotion || !canPlayAttention()) return;
      const tryPlay = () => {
        // Never on a hidden tab (it would burn the session/weekly cap unseen).
        if (
          typeof document !== 'undefined' &&
          document.visibilityState === 'hidden'
        ) {
          attentionTimers.current.push(
            window.setTimeout(tryPlay, ATTENTION_SCROLL_IDLE_MS)
          );
          return;
        }
        const sinceScroll = Date.now() - lastScrollRef.current;
        if (sinceScroll < ATTENTION_SCROLL_IDLE_MS) {
          attentionTimers.current.push(
            window.setTimeout(tryPlay, ATTENTION_SCROLL_IDLE_MS - sinceScroll)
          );
          return;
        }
        if (!canPlayAttention()) return;
        recordAttention();
        setAttention(true);
        track(SITE_EVENT_ASSISTANT_ATTENTION_PLAYED, { trigger });
        attentionTimers.current.push(
          window.setTimeout(() => setAttention(false), ATTENTION_MS)
        );
      };
      tryPlay();
    },
    [reducedMotion, track]
  );

  useEffect(() => {
    const onRequest = (e: Event) => {
      const trigger = (e as CustomEvent<{ trigger?: string }>).detail?.trigger;
      if (trigger === 'zero_results' || trigger === 'reorder_eligible')
        playAttention(trigger);
    };
    window.addEventListener(ASSISTANT_ATTENTION_EVENT, onRequest);
    return () =>
      window.removeEventListener(ASSISTANT_ATTENTION_EVENT, onRequest);
  }, [playAttention]);

  useEffect(
    () => () => {
      attentionTimers.current.forEach((id) => window.clearTimeout(id));
      if (engageTimer.current != null) window.clearTimeout(engageTimer.current);
    },
    []
  );

  // First-run nudge: 3 s dwell on browse home, once per device.
  useEffect(() => {
    if (screen !== 'home' || hidden || hasSeenNudge()) return undefined;
    const timer = window.setTimeout(() => {
      if (hasSeenNudge()) return;
      markNudgeSeen();
      setNudgeOpen(true);
      track(SITE_EVENT_ASSISTANT_NUDGE_SHOWN, { screen });
      playAttention('first_run');
    }, NUDGE_DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [screen, hidden, track, playAttention]);

  // Leaving home closes an open nudge without reporting a dismiss.
  useEffect(() => {
    if (screen !== 'home') setNudgeOpen(false);
  }, [screen]);

  const nudgeOpenRef = useRef(false);
  nudgeOpenRef.current = nudgeOpen;
  const dismissNudge = useCallback(
    (reason: NudgeDismissReason) => {
      if (!nudgeOpenRef.current) return;
      nudgeOpenRef.current = false;
      setNudgeOpen(false);
      track(SITE_EVENT_ASSISTANT_NUDGE_DISMISSED, {
        screen,
        dismiss_reason: reason,
      });
    },
    [screen, track]
  );

  const open = (entry: 'orb' | 'orb_extended' | 'nudge') => {
    track(SITE_EVENT_ASSISTANT_LAUNCHER_TAP, { screen, variant, entry });
    if (nudgeOpen) dismissNudge('opened');
    
    // Build context from current route
    let context: any = undefined;
    const path = location.pathname;
    
    if (path.startsWith('/items/')) {
      const inventoryId = path.split('/items/')[1]?.split('/')[0];
      if (inventoryId) {
        context = {
          type: 'item_detail',
          inventoryId,
          // itemName could be pulled from page data if available
        };
      }
    } else if (path === '/orders') {
      context = {
        type: 'orders_list',
        hasCompletedOrders: true, // Default true; could check from page data if available
      };
    } else if (path.startsWith('/orders/') && !path.includes('/reorder')) {
      const orderId = path.split('/orders/')[1]?.split('/')[0];
      if (orderId) {
        context = {
          type: 'order_detail',
          orderId,
          // orderStatus could be pulled from page data if available
        };
      }
    }
    
    navigate('/assistant', context ? { state: { context } } : undefined);
  };

  const engage = () => {
    if (engageTimer.current != null) window.clearTimeout(engageTimer.current);
    engageTimer.current = null;
    setEngaged(true);
  };
  const disengage = () => {
    if (engageTimer.current != null) window.clearTimeout(engageTimer.current);
    engageTimer.current = window.setTimeout(
      () => setEngaged(false),
      ATTENTIVE_EXIT_MS
    );
  };

  if (hidden) return null;

  const state: RendaState = attention
    ? 'attention'
    : engaged
    ? 'attentive'
    : 'idle';
  // Accessible name must start with the visible pill when extended (WCAG 2.5.3).
  const label = extended
    ? t(
        'assistant.launcher.labelExtended',
        'Ask: open shopping assistant'
      )
    : t('assistant.launcher.label', 'Open shopping assistant');

  return (
    <Box
      data-testid="assistant-launcher"
      data-variant={variant}
      sx={{
        position: 'fixed',
        right: isMobile ? 16 : 24,
        bottom: isMobile ? bottomOffset : 24,
        zIndex: zIndex.fixed,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 1.5,
        pointerEvents: 'none',
        '& > *': { pointerEvents: 'auto' },
      }}
    >
      {nudgeOpen && (
        <AssistantLauncherNudge
          onDismiss={dismissNudge}
          onTry={() => open('nudge')}
          ignoreRef={buttonRef}
        />
      )}
      <ButtonBase
        ref={buttonRef}
        onClick={() => open(extended ? 'orb_extended' : 'orb')}
        aria-label={label}
        aria-describedby={hintId}
        onPointerEnter={engage}
        onPointerLeave={disengage}
        onPointerDown={engage}
        onPointerUp={disengage}
        onFocus={engage}
        onBlur={disengage}
        sx={{
          height: 56,
          minWidth: 56,
          borderRadius: '28px',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          pr: extended ? 2 : 0,
          backgroundColor: extended ? brandTokens.surface.paper : 'transparent',
          border: extended
            ? `1px solid ${brandTokens.surface.border}`
            : '1px solid transparent',
          boxShadow: extended ? '0 6px 20px rgba(15, 23, 42, 0.12)' : 'none',
          transition:
            'padding 200ms cubic-bezier(0.2, 0, 0, 1), background-color 200ms',
          '&.Mui-focusVisible': {
            outline: `2px solid ${brandTokens.primary.main}`,
            outlineOffset: 2,
          },
        }}
      >
        <Box
          sx={{
            width: 54,
            height: 54,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RendaCharacter
            size={52}
            surface="launcher"
            state={state}
            data-testid="assistant-launcher-character"
          />
        </Box>
        {extended && (
          <Typography
            component="span"
            sx={{
              fontWeight: 600,
              fontSize: 15,
              color: brandTokens.primary.main,
              lineHeight: 1,
            }}
          >
            {t('assistant.launcher.ask', 'Ask')}
          </Typography>
        )}
      </ButtonBase>
      <Box component="span" id={hintId} sx={visuallyHidden}>
        {t('assistant.launcher.hint', 'Find items, reorder or track an order')}
      </Box>
      {/* Persistent polite live region: text inserted into it when the nudge opens is
          announced (a live region mounted together with its content often is not). */}
      <Box
        component="span"
        role="status"
        aria-live="polite"
        data-testid="assistant-launcher-announcer"
        sx={visuallyHidden}
      >
        {nudgeOpen
          ? t(
              'assistant.nudge.text',
              'Hi! I can find items, track your order or reorder for you.'
            )
          : ''}
      </Box>
    </Box>
  );
}

export default AssistantLauncher;
