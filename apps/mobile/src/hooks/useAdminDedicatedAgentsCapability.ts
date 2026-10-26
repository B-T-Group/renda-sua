import { useEffect, useState } from 'react';
import dedicatedAgentsService from '../services/dedicatedAgentsService';
import { shouldShowAdminDedicatedEntry } from '../utils/adminDedicatedAssign';
import type { AdminDedicatedCapabilityResponse } from '../types/dedicatedAgents';

/**
 * Gate for the admin "Dedicated agents" entry points. Only calls
 * GET /admin/dedicated-agents/capability for users who hold platform.manage.agents
 * (`canManageAgents`), and shows the entry only when it answers `enabled: true`.
 * Any error (including 404 when the flag is off, or 403) hides the entry.
 */
export function useAdminDedicatedAgentsCapability(canManageAgents: boolean) {
  const [capability, setCapability] = useState<AdminDedicatedCapabilityResponse | null>(null);
  const [loading, setLoading] = useState(canManageAgents);

  useEffect(() => {
    if (!canManageAgents) {
      setCapability(null);
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    dedicatedAgentsService
      .getAdminCapability()
      .then((res) => {
        if (mounted) setCapability(res);
      })
      .catch(() => {
        if (mounted) setCapability(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [canManageAgents]);

  return {
    capability,
    loading,
    visible: shouldShowAdminDedicatedEntry(canManageAgents, capability),
  };
}
