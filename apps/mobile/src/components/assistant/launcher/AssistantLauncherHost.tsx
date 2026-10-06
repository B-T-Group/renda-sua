/**
 * Floating Renda launcher (#451 spec §1), behind client flag
 * `assistant_launcher_v1` (default off; read via ClientFlagsContext, which uses
 * the #458 clientFlagsLoader). Mounted once per Client / Guest root navigator;
 * the allowlist is the focused route, so it never shows on checkout, auth,
 * chat, item detail, reels, or behind sheets / the keyboard / FTUE / the
 * market prompt. Mounts deferred and stays at the resting offset (does not
 * ride the floating pill's hide-on-scroll).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import { useClientFlags } from '../../../contexts/ClientFlagsContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { rootNavigationRef } from '../../../navigation/rootNavigationRef';
import { useTabBarGeometry } from '../../../navigation/tabBarGeometry';
import { useStore } from '../../../stores/RootStore';
import {
  ATTENTION_DURATION_MS,
  ATTENTION_STORAGE_KEY,
  LAUNCHER_CHARACTER_SIZE,
  LAUNCHER_TARGET,
  NUDGE_AUTO_HIDE_MS,
  NUDGE_DWELL_MS,
  NUDGE_STORAGE_KEY,
  attentionDelay,
  canPlayAttention,
  canShowNudge,
  cartFabVisibleOn,
  launcherPlacement,
  parseAttentionHistory,
  recordAttention,
  shouldShowLauncher,
  type AttentionTrigger,
  type LauncherPersona,
  type NudgeDismissReason,
} from '../../../utils/assistantLauncher';
import {
  trackAttentionPlayed,
  trackLauncherImpression,
  trackLauncherTap,
  trackNudgeDismissed,
  trackNudgeShown,
  type LauncherEntry,
  type LauncherEventContext,
} from '../../../services/analytics/assistantLauncherAnalytics';
import { RendaCharacter, type RendaCharacterState } from '../renda/RendaCharacter';
import { AssistantLauncherNudge } from './AssistantLauncherNudge';
import { useLauncherSuppressed } from './useLauncherSuppressor';
import {
  useDeferredMount,
  useFocusedRouteName,
  useInteractionSettled,
  useKeyboardOpen,
} from './launcherHooks';
import { lastLauncherInteractionAt, markLauncherInteraction } from './launcherSignals';

const DEFERRED_MOUNT_MS = 1500;

/** Session-scoped (module) state: one nudge and one attention ripple per app session. */
const session = { nudgeShown: false, attentionPlayed: false };

type AttentionRequest = { trigger: AttentionTrigger };
let attentionListener: ((req: AttentionRequest) => void) | null = null;

/**
 * Ask the launcher for the rare attention ripple (caps: 1 per session, 3 per
 * 7 days; waits for 2 s of touch idle; ignored when the launcher is hidden).
 */
export function requestAssistantAttention(trigger: AttentionTrigger): void {
  attentionListener?.({ trigger });
}

function useNudgeSeen(): [boolean | null, () => void] {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(NUDGE_STORAGE_KEY)
      .then((v) => active && setSeen(v === '1'))
      .catch(() => active && setSeen(true));
    return () => {
      active = false;
    };
  }, []);
  const markSeen = useCallback(() => {
    setSeen(true);
    void AsyncStorage.setItem(NUDGE_STORAGE_KEY, '1').catch(() => undefined);
  }, []);
  return [seen, markSeen];
}

export const AssistantLauncherHost = observer(function AssistantLauncherHost({
  persona,
}: {
  persona: LauncherPersona;
}) {
  const { flags } = useClientFlags();
  const flagOn = flags.assistant_launcher_v1;
  const mounted = useDeferredMount(DEFERRED_MOUNT_MS, flagOn);
  if (!flagOn || !mounted) return null;
  return <LauncherBody persona={persona} />;
});

const LauncherBody = observer(function LauncherBody({ persona }: { persona: LauncherPersona }) {
  const { t, i18n } = useTranslation();
  const store = useStore();
  const { ftue, market, cart, assistant } = store;
  const geometry = useTabBarGeometry();
  const route = useFocusedRouteName();
  const keyboardOpen = useKeyboardOpen();
  const suppressed = useLauncherSuppressed();
  const reducedMotion = useReducedMotion();
  const [seen, markSeen] = useNudgeSeen();
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [charState, setCharState] = useState<RendaCharacterState>('idle');
  const [replayKey, setReplayKey] = useState(0);
  // Settle: idle eases to static after 20 s without touch / scroll; a route change resumes.
  const settled = useInteractionSettled(route);

  const visible = shouldShowLauncher({
    flagOn: true,
    viewer: persona,
    route,
    mounted: true,
    keyboardOpen,
    suppressed,
    ftueShowing: !ftue.hydrated || ftue.shouldShowOnboarding,
    marketPromptShowing: market.pendingPromptCountry !== null,
  });

  const ctx: LauncherEventContext = {
    persona,
    screen: route ?? 'unknown',
    market: market.selectedCountryCode,
    language: i18n.language,
    threadId: assistant.threadId,
  };
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const tRef = useRef(t);
  tRef.current = t;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  // Impression: once per app session per screen.
  useEffect(() => {
    if (visible && route) trackLauncherImpression(ctxRef.current, 'orb', reducedMotion);
  }, [visible, route, reducedMotion]);

  // Attention ripple (rare, capped, waits for 2 s idle, never when hidden).
  const attentionEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playAttention = useCallback(
    async (trigger: AttentionTrigger) => {
      // Read live values: this runs after the idle wait, not when it was scheduled.
      if (!visibleRef.current || reducedMotion || session.attentionPlayed) return;
      let history: number[];
      try {
        history = parseAttentionHistory(await AsyncStorage.getItem(ATTENTION_STORAGE_KEY));
      } catch {
        return;
      }
      const now = Date.now();
      if (!visibleRef.current || !canPlayAttention(history, now, session.attentionPlayed)) return;
      session.attentionPlayed = true;
      void AsyncStorage.setItem(ATTENTION_STORAGE_KEY, JSON.stringify(recordAttention(history, now))).catch(
        () => undefined
      );
      setCharState('attention');
      setReplayKey((k) => k + 1);
      trackAttentionPlayed(ctxRef.current, trigger);
      if (attentionEndTimer.current) clearTimeout(attentionEndTimer.current);
      attentionEndTimer.current = setTimeout(() => {
        attentionEndTimer.current = null;
        setCharState((s) => (s === 'attention' ? 'idle' : s));
      }, ATTENTION_DURATION_MS);
    },
    [reducedMotion]
  );
  // Wait for 2 s of touch / scroll idle (re-checked after each wait), then play.
  const attentionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestAttention = useCallback(
    (trigger: AttentionTrigger) => {
      const attempt = () => {
        const wait = attentionDelay(lastLauncherInteractionAt(), Date.now());
        if (wait > 0) {
          attentionTimer.current = setTimeout(attempt, wait);
          return;
        }
        attentionTimer.current = null;
        void playAttention(trigger);
      };
      if (attentionTimer.current) clearTimeout(attentionTimer.current);
      attempt();
    },
    [playAttention]
  );
  useEffect(
    () => () => {
      if (attentionTimer.current) clearTimeout(attentionTimer.current);
      if (attentionEndTimer.current) clearTimeout(attentionEndTimer.current);
    },
    []
  );
  useEffect(() => {
    const listener = (req: AttentionRequest) => requestAttention(req.trigger);
    attentionListener = listener;
    return () => {
      // Only clear our own registration (a newer host may have replaced it).
      if (attentionListener === listener) attentionListener = null;
    };
  }, [requestAttention]);

  // First-run nudge after 3 s dwell on browse home.
  const nudgeEligible =
    !session.nudgeShown &&
    canShowNudge({
      seen,
      route,
      launcherVisible: visible,
      ftueComplete: ftue.hydrated && !ftue.shouldShowOnboarding,
      marketPromptThisSession: market.promptShownThisSession,
    });
  useEffect(() => {
    if (!nudgeEligible) return undefined;
    const timer = setTimeout(() => {
      session.nudgeShown = true;
      markSeen();
      setNudgeVisible(true);
      trackNudgeShown(ctxRef.current);
      // Screen readers keep focus where it was; announce the bubble once.
      AccessibilityInfo.announceForAccessibility(
        tRef.current('assistant.nudge.body', 'Hi! I can find items, track your order or reorder for you.')
      );
      requestAttention('first_run');
    }, NUDGE_DWELL_MS);
    return () => clearTimeout(timer);
  }, [nudgeEligible, markSeen, requestAttention]);

  const dismissNudge = useCallback((reason: NudgeDismissReason) => {
    setNudgeVisible((wasVisible) => {
      if (wasVisible) trackNudgeDismissed(ctxRef.current, reason);
      return false;
    });
  }, []);
  useEffect(() => {
    if (!nudgeVisible) return undefined;
    const timer = setTimeout(() => dismissNudge('timeout'), NUDGE_AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [nudgeVisible, dismissNudge]);
  // A hidden launcher takes its nudge with it.
  useEffect(() => {
    if (!visible && nudgeVisible) dismissNudge('outside');
  }, [visible, nudgeVisible, dismissNudge]);

  const openChat = useCallback(
    (entry: LauncherEntry) => {
      if (nudgeVisible) dismissNudge('opened');
      trackLauncherTap(ctxRef.current, 'orb', entry);
      if (rootNavigationRef.isReady()) {
        rootNavigationRef.dispatch(CommonActions.navigate({ name: 'AssistantChat' }));
      }
    },
    [nudgeVisible, dismissNudge]
  );

  // Press-in → Attentive; press-out + 150 ms → Idle.
  const pressOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPressIn = useCallback(() => {
    if (pressOutTimer.current) clearTimeout(pressOutTimer.current);
    markLauncherInteraction();
    setCharState((s) => (s === 'attention' ? s : 'attentive'));
  }, []);
  const onPressOut = useCallback(() => {
    pressOutTimer.current = setTimeout(
      () => setCharState((s) => (s === 'attentive' ? 'idle' : s)),
      150
    );
  }, []);
  useEffect(
    () => () => {
      if (pressOutTimer.current) clearTimeout(pressOutTimer.current);
    },
    []
  );

  if (!visible || !route) return null;

  const placement = launcherPlacement({
    route,
    cartFabVisible: cartFabVisibleOn(route, cart.distinctLineCount),
    tabBarOverlayHeight: geometry.tabBarOverlayHeight,
    bottomInset: geometry.bottomInset,
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {nudgeVisible ? (
        <AssistantLauncherNudge
          right={placement.right}
          bottom={placement.bottom + LAUNCHER_TARGET + 10}
          onDismiss={dismissNudge}
          onTry={() => openChat('nudge')}
        />
      ) : null}
      <Pressable
        onPress={() => openChat('orb')}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={t('assistant.launcher.a11y', 'Open shopping assistant')}
        accessibilityHint={t('assistant.launcher.hint', 'Find items, reorder or track an order')}
        style={[styles.target, { right: placement.right, bottom: placement.bottom }]}
        testID="assistant-launcher"
      >
        <RendaCharacter
          size={LAUNCHER_CHARACTER_SIZE}
          state={charState}
          replayKey={replayKey}
          paused={settled && charState === 'idle'}
        />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  target: {
    position: 'absolute',
    width: LAUNCHER_TARGET,
    height: LAUNCHER_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
});
