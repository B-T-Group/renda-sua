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

function parseRoles(data: unknown): DelegationRoleSummary[] {
  if (!data || typeof data !== 'object') return [];
  const payload = data as { roles?: unknown; data?: { roles?: unknown } };
  const raw = payload.roles ?? payload.data?.roles;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (row): row is DelegationRoleSummary =>
      Boolean(
        row &&
          typeof row === 'object' &&
          typeof (row as DelegationRoleSummary).id === 'string'
      )
  );
}

function mergeRoles(
  a: DelegationRoleSummary[],
  b: DelegationRoleSummary[]
): DelegationRoleSummary[] {
  return [...a, ...b].filter(
    (role, index, all) => all.findIndex((r) => r.id === role.id) === index
  );
}

function rejectionMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error || e?.message || fallback;
}

function errorStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

function applySettledRefresh(
  teamRes: PromiseSettledResult<{ data: Record<string, unknown> }>,
  rolesRes: PromiseSettledResult<{ data: Record<string, unknown> }>,
  setMembers: (v: DelegationTeamMember[]) => void,
  setInvites: (v: DelegationTeamInvite[]) => void,
  setRoles: (v: DelegationRoleSummary[]) => void,
  setError: (v: string | null) => void
) {
  const teamData = teamRes.status === 'fulfilled' ? teamRes.value.data : null;
  const nextRoles = mergeRoles(
    parseRoles(rolesRes.status === 'fulfilled' ? rolesRes.value.data : null),
    parseRoles(teamData)
  );
  if (teamData) {
    setMembers((teamData.members as DelegationTeamMember[]) || []);
    setInvites((teamData.invites as DelegationTeamInvite[]) || []);
  }
  if (nextRoles.length) setRoles(nextRoles);
  applyRefreshErrors(teamRes, rolesRes, nextRoles.length, setMembers, setInvites, setRoles, setError);
}

function applyRefreshErrors(
  teamRes: PromiseSettledResult<unknown>,
  rolesRes: PromiseSettledResult<unknown>,
  roleCount: number,
  setMembers: (v: DelegationTeamMember[]) => void,
  setInvites: (v: DelegationTeamInvite[]) => void,
  setRoles: (v: DelegationRoleSummary[]) => void,
  setError: (v: string | null) => void
) {
  if (teamRes.status !== 'rejected') {
    if (rolesRes.status === 'rejected' && !roleCount && errorStatus(rolesRes.reason) !== 404) {
      setError(rejectionMessage(rolesRes.reason, 'Failed to load roles'));
    }
    return;
  }
  if (errorStatus(teamRes.reason) === 404) {
    setMembers([]);
    setInvites([]);
    if (!roleCount) setRoles([]);
    setError(null);
    return;
  }
  setError(rejectionMessage(teamRes.reason, 'Failed to load team'));
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
      const [teamRes, rolesRes] = await Promise.allSettled([
        apiClient.get('/business-delegations'),
        apiClient.get('/business-delegations/roles'),
      ]);
      applySettledRefresh(
        teamRes,
        rolesRes,
        setMembers,
        setInvites,
        setRoles,
        setError
      );
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load team');
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
