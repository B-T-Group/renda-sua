import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import type {
  DelegationRoleSummary,
  DelegationTeamInvite,
  DelegationTeamMember,
} from '../types/delegation';

export interface CreateDelegationInviteInput {
  email: string;
  business_location_id: string;
  role_id: string;
  first_name?: string;
  last_name?: string;
}

export function useBusinessDelegations(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const apiClient = useApiClient();
  const [members, setMembers] = useState<DelegationTeamMember[]>([]);
  const [invites, setInvites] = useState<DelegationTeamInvite[]>([]);
  const [roles, setRoles] = useState<DelegationRoleSummary[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const [teamRes, rolesRes] = await Promise.all([
        apiClient.get('/business-delegations'),
        apiClient.get('/business-delegations/roles'),
      ]);
      setMembers(teamRes.data.members || []);
      setInvites(teamRes.data.invites || []);
      setRoles(rolesRes.data.roles || []);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setMembers([]);
        setInvites([]);
        setRoles([]);
        setError(null);
      } else {
        setError(
          err?.response?.data?.error ||
            err?.message ||
            'Failed to load team'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [apiClient, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createInvite = useCallback(
    async (input: CreateDelegationInviteInput) => {
      const res = await apiClient.post('/business-delegations/invites', input);
      await refresh();
      return res.data;
    },
    [apiClient, refresh]
  );

  const resendInvite = useCallback(
    async (inviteId: string, roleId?: string) => {
      const res = await apiClient.post(
        `/business-delegations/invites/${inviteId}/resend`,
        roleId ? { role_id: roleId } : {}
      );
      await refresh();
      return res.data;
    },
    [apiClient, refresh]
  );

  const changeInviteRole = useCallback(
    async (inviteId: string, roleId: string) => {
      const res = await apiClient.patch(
        `/business-delegations/invites/${inviteId}`,
        { role_id: roleId }
      );
      await refresh();
      return res.data;
    },
    [apiClient, refresh]
  );

  const changeMemberRole = useCallback(
    async (memberId: string, roleId: string) => {
      const res = await apiClient.patch(`/business-delegations/${memberId}`, {
        role_id: roleId,
      });
      await refresh();
      return res.data;
    },
    [apiClient, refresh]
  );

  const revokeMember = useCallback(
    async (memberId: string) => {
      const res = await apiClient.post(
        `/business-delegations/${memberId}/revoke`
      );
      await refresh();
      return res.data;
    },
    [apiClient, refresh]
  );

  return {
    members,
    invites,
    roles,
    loading,
    error,
    refresh,
    createInvite,
    resendInvite,
    changeInviteRole,
    changeMemberRole,
    revokeMember,
  };
}
