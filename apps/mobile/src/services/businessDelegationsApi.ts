/**
 * Owner team APIs for location delegations (`/business-delegations/*`).
 */

import { api } from './apiClient';
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

export interface DelegationTeamResponse {
  success?: boolean;
  members?: DelegationTeamMember[];
  invites?: DelegationTeamInvite[];
  roles?: DelegationRoleSummary[];
  error?: string;
}

export interface DelegationRolesResponse {
  success?: boolean;
  roles?: DelegationRoleSummary[];
  error?: string;
}

export const businessDelegationsApi = {
  listTeam: (): Promise<DelegationTeamResponse> =>
    api.get('/business-delegations'),

  listRoles: (): Promise<DelegationRolesResponse> =>
    api.get('/business-delegations/roles'),

  createInvite: (
    input: CreateDelegationInviteInput
  ): Promise<{ success?: boolean; invite?: DelegationTeamInvite; error?: string }> =>
    api.post('/business-delegations/invites', input),

  resendInvite: (
    inviteId: string,
    roleId?: string
  ): Promise<{ success?: boolean; error?: string }> =>
    api.post(
      `/business-delegations/invites/${inviteId}/resend`,
      roleId ? { role_id: roleId } : {}
    ),

  changeInviteRole: (
    inviteId: string,
    roleId: string
  ): Promise<{ success?: boolean; error?: string }> =>
    api.patch(`/business-delegations/invites/${inviteId}`, { role_id: roleId }),

  changeMemberRole: (
    memberId: string,
    roleId: string
  ): Promise<{ success?: boolean; error?: string }> =>
    api.patch(`/business-delegations/${memberId}`, { role_id: roleId }),

  revokeMember: (
    memberId: string
  ): Promise<{ success?: boolean; error?: string }> =>
    api.post(`/business-delegations/${memberId}/revoke`),
};
