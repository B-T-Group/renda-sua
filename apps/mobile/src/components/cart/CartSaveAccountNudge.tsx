import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ContextualNudgeCard } from '../common/ContextualNudgeCard';
import { NudgeService } from '../../services/nudges/NudgeService';
import { useStore } from '../../stores/RootStore';
import { navigateToGuestSignup } from '../../navigation/rootNavigationRef';

function CartSaveAccountNudgeBase() {
  const { auth, cart, ftue } = useStore();
  const [hidden, setHidden] = useState(false);
  const markedRef = useRef(false);

  const nudge = useMemo(() => {
    if (hidden || auth.isAuthenticated) return null;
    return NudgeService.resolve({
      ftue,
      surface: 'cart',
      isAuthenticated: false,
      hasCartItems: cart.items.length > 0,
    });
  }, [auth.isAuthenticated, cart.items.length, ftue, hidden]);

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
    />
  );
}

export const CartSaveAccountNudge = observer(CartSaveAccountNudgeBase);
