import { useCallback, useRef, useState } from 'react';
import {
  businessDelegationsApi,
  type CreateDelegationInviteInput,
} from '../services/businessDelegationsApi';
import type {
  DelegationRoleSummary,
  DelegationTeamInvite,
  DelegationTeamMember,
} from '../types/delegation';

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: string; status?: number };
    if (e.status === 404) return '';
    if (typeof e.message === 'string' && e.message.trim()) return e.message;
  }
  return fallback;
}

export function useBusinessDelegations(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const [members, setMembers] = useState<DelegationTeamMember[]>([]);
  const [invites, setInvites] = useState<DelegationTeamInvite[]>([]);
  const [roles, setRoles] = useState<DelegationRoleSummary[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const [teamResult, rolesResult] = await Promise.allSettled([
        businessDelegationsApi.listTeam(),
        businessDelegationsApi.listRoles(),
      ]);
      if (requestId !== requestIdRef.current) return;

      const fromRoles =
        rolesResult.status === 'fulfilled' ? rolesResult.value.roles || [] : [];
      const fromTeam =
        teamResult.status === 'fulfilled' ? teamResult.value.roles || [] : [];
      const nextRoles = [...fromRoles, ...fromTeam].filter(
        (role, index, all) => all.findIndex((r) => r.id === role.id) === index
      );
      if (nextRoles.length) setRoles(nextRoles);

      if (teamResult.status === 'fulfilled') {
        setMembers(teamResult.value.members || []);
        setInvites(teamResult.value.invites || []);
        if (rolesResult.status === 'rejected' && !nextRoles.length) {
          setError(errorMessage(rolesResult.reason, 'Failed to load roles') || null);
        } else {
          setError(null);
        }
        return;
      }

      const msg = errorMessage(teamResult.reason, 'Failed to load team');
      if (!msg) {
        setMembers([]);
        setInvites([]);
        setError(null);
      } else {
        setError(msg);
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [enabled]);

  const createInvite = useCallback(
    async (input: CreateDelegationInviteInput) => {
      const res = await businessDelegationsApi.createInvite(input);
      if (res.invite) {
        setInvites((prev) => [res.invite as DelegationTeamInvite, ...prev]);
      }
      void refresh();
      return res;
    },
    [refresh]
  );

  const resendInvite = useCallback(
    async (inviteId: string, roleId?: string) => {
      const res = await businessDelegationsApi.resendInvite(inviteId, roleId);
      void refresh();
      return res;
    },
    [refresh]
  );

  const changeInviteRole = useCallback(
    async (inviteId: string, roleId: string) => {
      const res = await businessDelegationsApi.changeInviteRole(inviteId, roleId);
      const nextRole = roles.find((r) => r.id === roleId);
      setInvites((prev) =>
        prev.map((inv) =>
          inv.id === inviteId
            ? {
                ...inv,
                role: nextRole
                  ? { id: nextRole.id, key: nextRole.key, name: nextRole.name }
                  : inv.role,
              }
            : inv
        )
      );
      void refresh();
      return res;
    },
    [refresh, roles]
  );

  const changeMemberRole = useCallback(
    async (memberId: string, roleId: string) => {
      const res = await businessDelegationsApi.changeMemberRole(memberId, roleId);
      const nextRole = roles.find((r) => r.id === roleId);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? {
                ...m,
                role: nextRole
                  ? { id: nextRole.id, key: nextRole.key, name: nextRole.name }
                  : m.role,
              }
            : m
        )
      );
      void refresh();
      return res;
    },
    [refresh, roles]
  );

  const revokeMember = useCallback(
    async (memberId: string) => {
      const res = await businessDelegationsApi.revokeMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      void refresh();
      return res;
    },
    [refresh]
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
