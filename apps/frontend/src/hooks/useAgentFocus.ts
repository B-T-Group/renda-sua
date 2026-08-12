import { useMemo } from 'react';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import {
  normalizeAgentFocus,
  showsCommercialChrome,
  showsDeliveryChrome,
  type AgentFocus,
} from '../utils/agentFocus';

export function useAgentFocus() {
  const { profile, loading } = useUserProfileContext();
  const known = Boolean(profile?.agent);
  const focus: AgentFocus | null = useMemo(() => {
    if (!known) return null;
    return normalizeAgentFocus(profile?.agent?.focus);
  }, [known, profile?.agent?.focus]);
  return {
    focus,
    showDelivery: !known || showsDeliveryChrome(focus),
    showCommercial: known && showsCommercialChrome(focus),
    loading,
  };
}
