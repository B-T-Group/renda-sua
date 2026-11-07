import React from 'react';
import { useTranslation } from 'react-i18next';
import { FeatureCard } from '../common/FeatureCard';
import EarnDeliveringIllustration from '../illustrations/EarnDeliveringIllustration';
import { usePersistedDismiss } from '../../hooks/usePersistedDismiss';
import { useStore } from '../../stores/RootStore';

const tipKey = (userId: string) => `rendasua:agent:${userId}:tip:stay-nearby`;

/** Dismissible Home tip encouraging agents to stay near busy stores. */
export function AgentStayNearbyTip() {
  const { t } = useTranslation();
  const { auth } = useStore();
  const userId = auth.user?.id ?? null;
  const { visible, dismiss } = usePersistedDismiss(userId ? tipKey(userId) : null);

  if (!visible) return null;

  return (
    <FeatureCard
      title={t('ftue.education.agentTipTitle', 'Tip: stay nearby')}
      message={t(
        'ftue.education.agentTipMessage',
        'Going available near busy stores helps you get offers faster.'
      )}
      illustration={<EarnDeliveringIllustration size={96} />}
      onDismiss={dismiss}
      dismissLabel={t('ftue.nudges.dismiss', 'Not now')}
    />
  );
}

export default AgentStayNearbyTip;
