import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { INVITE_TTL_DAYS } from './delegation.constants';
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiresAt,
} from './token.util';

export interface AssignableRole {
  id: string;
  key: string;
  name: string;
  description: string;
  is_assignable: boolean;
}

@Injectable()
export class BusinessDelegationsService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Configuration>
  ) {}

  async listAssignableRoles() {
    const result = await this.hasura.executeQuery<{
      location_delegation_roles: AssignableRole[];
    }>(
      `
      query AssignableRoles {
        location_delegation_roles(
          where: { is_assignable: { _eq: true } }
          order_by: { name: asc }
        ) {
          id key name description is_assignable
        }
      }
    `
    );
    return result.location_delegation_roles ?? [];
  }

  async listTeam(businessId: string) {
    const [members, invites] = await Promise.all([
      this.listMembers(businessId),
      this.listPendingInvites(businessId),
    ]);
    return { members, invites };
  }

  async createInvite(
    owner: { id: string; email?: string | null; first_name?: string | null },
    businessId: string,
    input: {
      email: string;
      business_location_id: string;
      role_id: string;
      first_name?: string;
      last_name?: string;
    }
  ) {
    const email = this.normalizeEmail(input.email);
    this.assertNotSelfInvite(owner.email, email);
    const location = await this.requireOwnedLocation(
      businessId,
      input.business_location_id
    );
    const role = await this.requireAssignableRole(input.role_id);
    await this.supersedePending(email, input.business_location_id);
    const token = generateInviteToken();
    const invite = await this.insertInvite({
      email,
      tokenHash: hashInviteToken(token),
      expiresAt: inviteExpiresAt(INVITE_TTL_DAYS).toISOString(),
      roleId: role.id,
      locationId: input.business_location_id,
      invitedBy: owner.id,
      firstName: input.first_name?.trim() || null,
      lastName: input.last_name?.trim() || null,
    });
    await this.writeEvent('invited', owner.id, {
      inviteId: invite.id,
      toRoleId: role.id,
    });
    await this.sendInviteEmail(token, owner, location, role, email, invite.expires_at);
    return { invite: this.publicInvite(invite, role) };
  }

  async resendInvite(
    owner: { id: string; first_name?: string | null },
    businessId: string,
    inviteId: string,
    roleId?: string
  ) {
    const invite = await this.requireOwnedPendingInvite(businessId, inviteId);
    const role = await this.requireAssignableRole(roleId || invite.role_id);
    const token = generateInviteToken();
    const updated = await this.refreshInvite(invite.id, {
      tokenHash: hashInviteToken(token),
      expiresAt: inviteExpiresAt(INVITE_TTL_DAYS).toISOString(),
      roleId: role.id,
    });
    await this.writeEvent('resent', owner.id, {
      inviteId: invite.id,
      fromRoleId: invite.role_id,
      toRoleId: role.id,
    });
    const location = await this.requireOwnedLocation(
      businessId,
      invite.business_location_id
    );
    await this.sendInviteEmail(
      token,
      owner,
      location,
      role,
      invite.email,
      updated.expires_at
    );
    return { invite: this.publicInvite(updated, role) };
  }

  async patchInviteRole(ownerUserId: string, businessId: string, inviteId: string, roleId: string) {
    const invite = await this.requireOwnedPendingInvite(businessId, inviteId);
    const role = await this.requireAssignableRole(roleId);
    const updated = await this.refreshInvite(invite.id, { roleId: role.id });
    await this.writeEvent('role_changed', ownerUserId, {
      inviteId: invite.id,
      fromRoleId: invite.role_id,
      toRoleId: role.id,
    });
    return { invite: this.publicInvite(updated, role) };
  }

  async changeMemberRole(
    owner: { id: string; email?: string | null },
    businessId: string,
    delegationId: string,
    roleId: string
  ) {
    const member = await this.requireOwnedActiveMember(businessId, delegationId);
    this.assertNotSelfMember(owner.id, member.user_id);
    const role = await this.requireAssignableRole(roleId);
    const updated = await this.updateMemberRole(member.id, role.id);
    await this.writeEvent('role_changed', owner.id, {
      delegationId: member.id,
      fromRoleId: member.role_id,
      toRoleId: role.id,
    });
    return { member: this.publicMember(updated, role) };
  }

  async revokeMember(ownerUserId: string, businessId: string, delegationId: string) {
    const member = await this.requireOwnedActiveMember(businessId, delegationId);
    await this.hasura.executeMutation(
      `
      mutation RevokeDelegation($id: uuid!, $updatedAt: timestamptz!) {
        update_location_delegations_by_pk(
          pk_columns: { id: $id }
          _set: { status: "revoked", updated_at: $updatedAt }
        ) { id status }
      }
    `,
      { id: member.id, updatedAt: new Date().toISOString() }
    );
    await this.writeEvent('revoked', ownerUserId, { delegationId: member.id });
    return { success: true };
  }

  private normalizeEmail(email: string): string {
    const value = String(email || '').trim().toLowerCase();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value)) {
      throw new HttpException('Valid email is required', HttpStatus.BAD_REQUEST);
    }
    return value;
  }

  private assertNotSelfInvite(ownerEmail: string | null | undefined, email: string) {
    if (ownerEmail && ownerEmail.trim().toLowerCase() === email) {
      throw new HttpException(
        'You cannot invite yourself',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private assertNotSelfMember(ownerUserId: string, memberUserId: string) {
    if (ownerUserId === memberUserId) {
      throw new HttpException(
        'You cannot assign a delegation role to yourself',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async requireAssignableRole(roleId: string): Promise<AssignableRole> {
    const result = await this.hasura.executeQuery<{
      location_delegation_roles_by_pk: AssignableRole | null;
    }>(
      `
      query Role($id: uuid!) {
        location_delegation_roles_by_pk(id: $id) {
          id key name description is_assignable
        }
      }
    `,
      { id: roleId }
    );
    const role = result.location_delegation_roles_by_pk;
    if (!role) {
      throw new HttpException('Unknown role', HttpStatus.BAD_REQUEST);
    }
    if (!role.is_assignable) {
      throw new HttpException('Role is not assignable', HttpStatus.BAD_REQUEST);
    }
    return role;
  }

  private async requireOwnedLocation(businessId: string, locationId: string) {
    const result = await this.hasura.executeQuery<{
      business_locations_by_pk: {
        id: string;
        name: string;
        business_id: string;
        business?: { id: string; name?: string | null } | null;
      } | null;
    }>(
      `
      query OwnedLocation($id: uuid!) {
        business_locations_by_pk(id: $id) {
          id name business_id
          business { id name }
        }
      }
    `,
      { id: locationId }
    );
    const location = result.business_locations_by_pk;
    if (!location || location.business_id !== businessId) {
      throw new HttpException('Location not found', HttpStatus.NOT_FOUND);
    }
    return location;
  }

  private async supersedePending(email: string, locationId: string) {
    await this.hasura.executeMutation(
      `
      mutation SupersedePending($email: String!, $locationId: uuid!, $updatedAt: timestamptz!) {
        update_location_delegation_invites(
          where: {
            email: { _ilike: $email }
            business_location_id: { _eq: $locationId }
            status: { _eq: "pending" }
          }
          _set: { status: "superseded", updated_at: $updatedAt }
        ) { affected_rows }
      }
    `,
      { email, locationId, updatedAt: new Date().toISOString() }
    );
  }

  private async insertInvite(input: {
    email: string;
    tokenHash: string;
    expiresAt: string;
    roleId: string;
    locationId: string;
    invitedBy: string;
    firstName: string | null;
    lastName: string | null;
  }) {
    const result = await this.hasura.executeMutation<{
      insert_location_delegation_invites_one: InviteRow;
    }>(
      `
      mutation InsertInvite($object: location_delegation_invites_insert_input!) {
        insert_location_delegation_invites_one(object: $object) {
          id email status expires_at role_id business_location_id
          first_name last_name invited_by_user_id created_at
        }
      }
    `,
      {
        object: {
          email: input.email,
          token_hash: input.tokenHash,
          expires_at: input.expiresAt,
          role_id: input.roleId,
          business_location_id: input.locationId,
          invited_by_user_id: input.invitedBy,
          first_name: input.firstName,
          last_name: input.lastName,
          status: 'pending',
        },
      }
    );
    return result.insert_location_delegation_invites_one;
  }

  private async refreshInvite(
    id: string,
    set: { tokenHash?: string; expiresAt?: string; roleId?: string }
  ) {
    const updates: Record<string, string> = { updated_at: new Date().toISOString() };
    if (set.tokenHash) updates.token_hash = set.tokenHash;
    if (set.expiresAt) updates.expires_at = set.expiresAt;
    if (set.roleId) updates.role_id = set.roleId;
    const result = await this.hasura.executeMutation<{
      update_location_delegation_invites_by_pk: InviteRow;
    }>(
      `
      mutation RefreshInvite($id: uuid!, $set: location_delegation_invites_set_input!) {
        update_location_delegation_invites_by_pk(pk_columns: { id: $id }, _set: $set) {
          id email status expires_at role_id business_location_id
          first_name last_name invited_by_user_id created_at
        }
      }
    `,
      { id, set: updates }
    );
    return result.update_location_delegation_invites_by_pk;
  }

  private async requireOwnedPendingInvite(businessId: string, inviteId: string) {
    const result = await this.hasura.executeQuery<{
      location_delegation_invites_by_pk: (InviteRow & {
        business_location?: { business_id: string } | null;
      }) | null;
    }>(
      `
      query Invite($id: uuid!) {
        location_delegation_invites_by_pk(id: $id) {
          id email status expires_at role_id business_location_id
          first_name last_name invited_by_user_id created_at
          business_location { business_id }
        }
      }
    `,
      { id: inviteId }
    );
    const invite = result.location_delegation_invites_by_pk;
    if (!invite || invite.business_location?.business_id !== businessId) {
      throw new HttpException('Invite not found', HttpStatus.NOT_FOUND);
    }
    if (invite.status !== 'pending') {
      throw new HttpException('Invite is not pending', HttpStatus.BAD_REQUEST);
    }
    return invite;
  }

  private async requireOwnedActiveMember(businessId: string, delegationId: string) {
    const result = await this.hasura.executeQuery<{
      location_delegations_by_pk: (MemberRow & {
        business_location?: { business_id: string } | null;
      }) | null;
    }>(
      `
      query Member($id: uuid!) {
        location_delegations_by_pk(id: $id) {
          id user_id role_id status business_location_id
          business_location { business_id }
          role { id key name }
          user { id email first_name last_name }
        }
      }
    `,
      { id: delegationId }
    );
    const member = result.location_delegations_by_pk;
    if (!member || member.business_location?.business_id !== businessId) {
      throw new HttpException('Delegation not found', HttpStatus.NOT_FOUND);
    }
    if (member.status !== 'active') {
      throw new HttpException('Delegation is not active', HttpStatus.BAD_REQUEST);
    }
    return member;
  }

  private async updateMemberRole(id: string, roleId: string) {
    const result = await this.hasura.executeMutation<{
      update_location_delegations_by_pk: MemberRow;
    }>(
      `
      mutation UpdateMemberRole($id: uuid!, $roleId: uuid!, $updatedAt: timestamptz!) {
        update_location_delegations_by_pk(
          pk_columns: { id: $id }
          _set: { role_id: $roleId, updated_at: $updatedAt }
        ) {
          id user_id role_id status business_location_id
          role { id key name }
          user { id email first_name last_name }
        }
      }
    `,
      { id, roleId, updatedAt: new Date().toISOString() }
    );
    return result.update_location_delegations_by_pk;
  }

  private async listMembers(businessId: string) {
    const result = await this.hasura.executeQuery<{
      location_delegations: MemberRow[];
    }>(
      `
      query TeamMembers($businessId: uuid!) {
        location_delegations(
          where: {
            status: { _eq: "active" }
            business_location: { business_id: { _eq: $businessId } }
          }
          order_by: { created_at: desc }
        ) {
          id user_id role_id status business_location_id created_at
          role {
            id key name
            role_permissions { permission { key } }
          }
          user { id email first_name last_name }
          business_location { id name }
        }
      }
    `,
      { businessId }
    );
    return (result.location_delegations ?? []).map((row) =>
      this.publicMember(row, row.role)
    );
  }

  private async listPendingInvites(businessId: string) {
    const result = await this.hasura.executeQuery<{
      location_delegation_invites: InviteRow[];
    }>(
      `
      query TeamInvites($businessId: uuid!) {
        location_delegation_invites(
          where: {
            status: { _eq: "pending" }
            business_location: { business_id: { _eq: $businessId } }
          }
          order_by: { created_at: desc }
        ) {
          id email status expires_at role_id business_location_id
          first_name last_name invited_by_user_id created_at
          role {
            id key name
            role_permissions { permission { key } }
          }
          business_location { id name }
        }
      }
    `,
      { businessId }
    );
    return (result.location_delegation_invites ?? []).map((row) =>
      this.publicInvite(row, row.role)
    );
  }

  private publicInvite(invite: InviteRow, role?: RoleSummary | null) {
    return {
      id: invite.id,
      email: invite.email,
      status: invite.status,
      expires_at: invite.expires_at,
      first_name: invite.first_name,
      last_name: invite.last_name,
      business_location_id: invite.business_location_id,
      location: invite.business_location
        ? { id: invite.business_location.id, name: invite.business_location.name }
        : undefined,
      role: role ? { id: role.id, key: role.key, name: role.name } : undefined,
      permissions: this.permissionsFromRole(role),
    };
  }

  private publicMember(member: MemberRow, role?: RoleSummary | null) {
    return {
      id: member.id,
      status: member.status,
      user: member.user,
      business_location_id: member.business_location_id,
      location: member.business_location
        ? { id: member.business_location.id, name: member.business_location.name }
        : undefined,
      role: role ? { id: role.id, key: role.key, name: role.name } : undefined,
      permissions: this.permissionsFromRole(role),
    };
  }

  private permissionsFromRole(role?: RoleSummary | null): string[] {
    return (role?.role_permissions ?? [])
      .map((rp) => rp.permission?.key)
      .filter((key): key is string => !!key);
  }

  private async writeEvent(
    eventType: string,
    actorUserId: string,
    refs: {
      inviteId?: string;
      delegationId?: string;
      fromRoleId?: string;
      toRoleId?: string;
    }
  ) {
    await this.hasura.executeMutation(
      `
      mutation WriteDelegationEvent($object: location_delegation_events_insert_input!) {
        insert_location_delegation_events_one(object: $object) { id }
      }
    `,
      {
        object: {
          event_type: eventType,
          actor_user_id: actorUserId,
          invite_id: refs.inviteId ?? null,
          delegation_id: refs.delegationId ?? null,
          from_role_id: refs.fromRoleId ?? null,
          to_role_id: refs.toRoleId ?? null,
        },
      }
    );
  }

  private async sendInviteEmail(
    token: string,
    owner: { first_name?: string | null },
    location: { name: string; business?: { name?: string | null } | null },
    role: { name: string },
    email: string,
    expiresAt: string
  ) {
    const webUrl = this.config.get('publicWebAppUrl') || 'https://rendasua.com';
    await this.notifications.sendLocationDelegationInviteEmail({
      to: email,
      inviterName: owner.first_name?.trim() || 'A store owner',
      businessName: location.business?.name || 'a store',
      locationName: location.name,
      roleName: role.name,
      acceptUrl: `${webUrl}/invite/${token}`,
      expiresAt,
    });
  }
}

interface RoleSummary {
  id: string;
  key: string;
  name: string;
  role_permissions?: Array<{ permission?: { key?: string } | null }>;
}

interface InviteRow {
  id: string;
  email: string;
  status: string;
  expires_at: string;
  role_id: string;
  business_location_id: string;
  first_name?: string | null;
  last_name?: string | null;
  invited_by_user_id: string;
  created_at?: string;
  role?: RoleSummary | null;
  business_location?: { id: string; name?: string | null } | null;
}

interface MemberRow {
  id: string;
  user_id: string;
  role_id: string;
  status: string;
  business_location_id: string;
  role?: RoleSummary | null;
  user?: {
    id: string;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  business_location?: { id: string; name?: string | null } | null;
}
