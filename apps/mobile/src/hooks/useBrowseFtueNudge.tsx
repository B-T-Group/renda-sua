import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ContextualNudgeCard } from '../components/common/ContextualNudgeCard';
import { FavoritesIllustration } from '../components/illustrations/FavoritesIllustration';
import { EarnDeliveringIllustration } from '../components/illustrations/EarnDeliveringIllustration';
import { OnboardingMerchantIllustration } from '../components/illustrations/OnboardingMerchantIllustration';
import { NudgeService } from '../services/nudges/NudgeService';
import { useStore } from '../stores/RootStore';
import { NUDGE_IDS } from '../constants/onboarding';
import { navigateToGuestSignup } from '../navigation/rootNavigationRef';
import { trackBrowseSessionStarted } from '../utils/ftueAnalytics';

function BrowseFtueNudgeBase() {
  const { auth, ftue } = useStore();
  const [hidden, setHidden] = useState(false);
  const markedRef = useRef<string | null>(null);
  const sessionViews = ftue.browseCounters.sessionProductViews;
  const intent = ftue.personaIntent;

  useEffect(() => {
    trackBrowseSessionStarted();
  }, []);

  const nudge = useMemo(() => {
    if (hidden) return null;
    return NudgeService.resolve({
      ftue,
      surface: 'browse',
      isAuthenticated: !!auth.isAuthenticated,
    });
  }, [auth.isAuthenticated, ftue, sessionViews, intent, hidden]);

  useEffect(() => {
    if (nudge && markedRef.current !== nudge.id) {
      markedRef.current = nudge.id;
      void ftue.markNudgeShown(nudge.id);
    }
  }, [ftue, nudge]);

  const goSignup = useCallback((persona: 'business' | 'agent' | 'client') => {
    navigateToGuestSignup({ preselectedPersona: persona, source: 'nudge' });
  }, []);

  const onAction = useCallback(() => {
    if (!nudge) return;
    void ftue.convertNudge(nudge.id);
    setHidden(true);
    if (nudge.id === NUDGE_IDS.sellHere) {
      goSignup('business');
      return;
    }
    if (nudge.id === NUDGE_IDS.becomeCourier) {
      goSignup('agent');
      return;
    }
    goSignup('client');
  }, [ftue, goSignup, nudge]);

  const onDismiss = useCallback(() => {
    if (!nudge) return;
    void ftue.dismissNudge(nudge.id);
    setHidden(true);
  }, [ftue, nudge]);

  if (!nudge) return null;

  const illustration =
    nudge.id === NUDGE_IDS.sellHere ? (
      <OnboardingMerchantIllustration size={96} />
    ) : nudge.id === NUDGE_IDS.becomeCourier ? (
      <EarnDeliveringIllustration size={96} />
    ) : (
      <FavoritesIllustration size={96} />
    );

  return (
    <ContextualNudgeCard
      nudge={nudge}
      onAction={onAction}
      onDismiss={onDismiss}
      illustration={illustration}
    />
  );
}

export const BrowseFtueNudge = observer(BrowseFtueNudgeBase);
