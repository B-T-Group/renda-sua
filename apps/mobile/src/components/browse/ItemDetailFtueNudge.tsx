import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ContextualNudgeCard } from '../common/ContextualNudgeCard';
import { FavoritesIllustration } from '../illustrations/FavoritesIllustration';
import { NudgeService } from '../../services/nudges/NudgeService';
import { useStore } from '../../stores/RootStore';
import { navigateToGuestSignup } from '../../navigation/rootNavigationRef';

function ItemDetailFtueNudgeBase() {
  const { auth, ftue } = useStore();
  const [hidden, setHidden] = useState(false);
  const markedRef = useRef(false);
  const sessionViews = ftue.browseCounters.sessionProductViews;

  const nudge = useMemo(() => {
    if (hidden || auth.isAuthenticated) return null;
    return NudgeService.resolve({
      ftue,
      surface: 'item_detail',
      isAuthenticated: false,
    });
  }, [auth.isAuthenticated, ftue, hidden, sessionViews]);

  useEffect(() => {
    if (nudge && !markedRef.current) {
      markedRef.current = true;
      void ftue.markNudgeShown(nudge.id);
    }
  }, [ftue, nudge]);

  const onAction = useCallback(() => {
    if (!nudge) return;
    void ftue.convertNudge(nudge.id);
    setHidden(true);
    navigateToGuestSignup({ preselectedPersona: 'client', source: 'nudge' });
  }, [ftue, nudge]);

  const onDismiss = useCallback(() => {
    if (!nudge) return;
    void ftue.dismissNudge(nudge.id);
    setHidden(true);
  }, [ftue, nudge]);

  if (!nudge) return null;
  return (
    <ContextualNudgeCard
      nudge={nudge}
      onAction={onAction}
      onDismiss={onDismiss}
      illustration={<FavoritesIllustration size={96} />}
    />
  );
}

export const ItemDetailFtueNudge = observer(ItemDetailFtueNudgeBase);
