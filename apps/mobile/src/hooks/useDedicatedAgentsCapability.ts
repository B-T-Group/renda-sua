import { useState, useEffect } from 'react';
import { apiRequest } from '../services/apiClient';

export interface DedicatedAgentsCapability {
  success: boolean;
  enabled?: boolean;
  country?: string;
  reason?: 'not_verified' | 'commercial_focus' | 'no_agent' | 'not_eligible';
}

export function useDedicatedAgentsCapability() {
  const [capability, setCapability] = useState<DedicatedAgentsCapability | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadCapability = async () => {
      try {
        const result = await apiRequest<DedicatedAgentsCapability>(
          '/agents/me/dedicated-agents/capability',
          { method: 'GET' }
        );
        
        if (mounted) {
          setCapability(result);
        }
      } catch (error: any) {
        if (mounted) {
          // On 404, enabled:false, commercial_focus, or no_agent, hide the feature
          if (error.status === 404) {
            setCapability({ success: false, enabled: false });
          } else {
            setCapability({ success: false });
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadCapability();

    return () => {
      mounted = false;
    };
  }, []);

  const shouldShowDedicatedAgents = 
    capability?.success === true && 
    capability?.enabled === true &&
    capability?.reason !== 'commercial_focus' &&
    capability?.reason !== 'no_agent';

  return {
    capability,
    loading,
    shouldShowDedicatedAgents,
  };
}
