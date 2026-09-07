import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReferralCodeCard } from '@/components/referrals/ReferralCodeCard';

export interface AgentReferralCodeCardProps {
  agentCode: string;
  helpText?: string;
}

export function AgentReferralCodeCard({
  agentCode,
  helpText,
}: AgentReferralCodeCardProps) {
  const { t } = useTranslation();
  return (
    <ReferralCodeCard
      code={agentCode}
      helpText={
        helpText ??
        t(
          'agent.referrals.shareHint',
          'Share this code with other agents and businesses so they can enter it when they sign up.'
        )
      }
      showShare
    />
  );
}
