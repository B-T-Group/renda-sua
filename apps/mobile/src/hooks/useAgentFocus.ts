import { useMemo } from 'react';
import { useProfileMe } from './useProfileMe';
import {
  normalizeAgentFocus,
  showsCommercialChrome,
  showsDeliveryChrome,
  type AgentFocus,
} from '../types/agentFocus';

export function useAgentFocus(enabled = true) {
  const { me, loading, refetch } = useProfileMe(enabled);
  const known = Boolean(me?.agent);
  const focus: AgentFocus | null = useMemo(() => {
    if (!known) return null;
    return normalizeAgentFocus(me?.agent?.focus);
  }, [known, me?.agent?.focus]);
  return {
    focus,
    showDelivery: !known || showsDeliveryChrome(focus),
    showCommercial: known && showsCommercialChrome(focus),
    loading,
    refetch,
  };
}
