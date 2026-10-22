import { useState, useEffect } from 'react';
import { apiRequest } from '../services/apiClient';

export interface DedicatedAgentsCapability {
  success: boolean;
  enabled?: boolean;
  country?: string | null;
  reason?: 'not_verified' | 'no_address' | 'no_country' | 'contract_unsigned' | 'suspended';
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
          // On 404, the feature is off
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

  // Show when enabled is true
  // Backend only returns null, no_address or no_country as reasons
  const shouldShowDedicatedAgents = 
    capability?.success === true && 
    capability?.enabled === true;

  return {
    capability,
    loading,
    shouldShowDedicatedAgents,
  };
}
