import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Auth0Service } from '../auth/auth0.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { hashInviteToken, isInviteExpired } from './token.util';

@Injectable()
export class PublicInviteService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly auth0: Auth0Service
  ) {}

  async preview(token: string) {
    const invite = await this.loadValidPending(token);
    return {
      business_name: invite.business_location?.business?.name ?? '',
      location_name: invite.business_location?.name ?? '',
      inviter_first_name: invite.invited_by?.first_name ?? '',
      expires_at: invite.expires_at,
      needs_name: !invite.first_name || !invite.last_name,
      role_name: invite.role?.name ?? '',
    };
  }

  async accept(
    token: string,
    body: { first_name?: string; last_name?: string },
    loggedIn?: { userId: string; email?: string | null }
  ) {
    const invite = await this.loadValidPending(token);
    this.assertLoggedInEmail(invite.email, loggedIn?.email);
    const names = this.resolveNames(invite, body);
    const user = await this.findOrCreateUser(invite.email, names);
    await this.attachGrant(user.id, invite);
    await this.consumeInvite(invite.id);
    await this.writeAccepted(user.id, invite);
    if (loggedIn?.userId === user.id) {
      return { success: true, already_authenticated: true, email: invite.email };
    }
    await this.auth0.startEmailOtp(invite.email);
    return { success: true, already_authenticated: false, email: invite.email };
  }

  private assertInviteLocationOwnedByInviter(invite: InvitePreviewRow): void {
    const inviterBusinessId = invite.invited_by?.business?.id;
    const locationBusinessId = invite.business_location?.business?.id;
    if (!inviterBusinessId || inviterBusinessId !== locationBusinessId) {
      throw new HttpException('Invite is no longer valid', HttpStatus.GONE);
    }
  }

  private assertLoggedInEmail(
    invitedEmail: string,
    loggedInEmail?: string | null
  ) {
    if (!loggedInEmail) return;
    if (loggedInEmail.trim().toLowerCase() !== invitedEmail) {
      throw new HttpException(
        { success: false, error: 'Signed in as a different account', invited_email: invitedEmail },
        HttpStatus.CONFLICT
      );
    }
  }

  private resolveNames(
    invite: InvitePreviewRow,
    body: { first_name?: string; last_name?: string }
  ) {
    const first = (body.first_name || invite.first_name || '').trim();
    const last = (body.last_name || invite.last_name || '').trim();
    if (!first || !last) {
      throw new HttpException(
        'First and last name are required',
        HttpStatus.BAD_REQUEST
      );
    }
    return { first_name: first, last_name: last };
  }

  private async loadValidPending(token: string): Promise<InvitePreviewRow> {
    const hash = hashInviteToken(token);
    const result = await this.hasura.executeQuery<{
      location_delegation_invites: InvitePreviewRow[];
    }>(
      `
      query InviteByHash($hash: String!) {
        location_delegation_invites(
          where: { token_hash: { _eq: $hash } }
          limit: 1
        ) {
          id email status expires_at role_id first_name last_name
          business_location_id
          role { id key name }
          invited_by { first_name business { id } }
          business_location {
            id name
            business { id name }
          }
        }
      }
    `,
      { hash }
    );
    const invite = result.location_delegation_invites?.[0];
    if (!invite) {
      throw new HttpException('Invite not found', HttpStatus.NOT_FOUND);
    }
    if (invite.status !== 'pending' || isInviteExpired(invite.expires_at)) {
      throw new HttpException('Invite is no longer valid', HttpStatus.GONE);
    }
    this.assertInviteLocationOwnedByInviter(invite);
    return invite;
  }

  private async findOrCreateUser(
    email: string,
    names: { first_name: string; last_name: string }
  ) {
    const existing = await this.findUserByEmail(email);
    if (existing) return existing;
    const result = await this.hasura.executeMutation<{
      insert_users_one: { id: string; email: string };
    }>(
      `
      mutation CreateDelegateUser(
        $email: String!
        $first_name: String!
        $last_name: String!
      ) {
        insert_users_one(object: {
          email: $email
          first_name: $first_name
          last_name: $last_name
          user_type_id: user
          email_verified: true
        }) { id email }
      }
    `,
      { email, first_name: names.first_name, last_name: names.last_name }
    );
    return result.insert_users_one;
  }

  private async findUserByEmail(email: string) {
    const result = await this.hasura.executeQuery<{
      users: Array<{ id: string; email: string }>;
    }>(
      `
      query UserByEmail($email: String!) {
        users(where: { email: { _eq: $email } }, limit: 1) { id email }
      }
    `,
      { email }
    );
    return result.users?.[0] || null;
  }

  private async attachGrant(userId: string, invite: InvitePreviewRow) {
    const existing = await this.findActiveGrant(userId, invite.business_location_id);
    if (existing) {
      await this.hasura.executeMutation(
        `
        mutation UpdateGrantRole($id: uuid!, $roleId: uuid!, $updatedAt: timestamptz!) {
          update_location_delegations_by_pk(
            pk_columns: { id: $id }
            _set: { role_id: $roleId, updated_at: $updatedAt }
          ) { id }
        }
      `,
        {
          id: existing.id,
          roleId: invite.role_id,
          updatedAt: new Date().toISOString(),
        }
      );
      return;
    }
    await this.hasura.executeMutation(
      `
      mutation InsertGrant($object: location_delegations_insert_input!) {
        insert_location_delegations_one(object: $object) { id }
      }
    `,
      {
        object: {
          user_id: userId,
          business_location_id: invite.business_location_id,
          role_id: invite.role_id,
          status: 'active',
        },
      }
    );
  }

  private async findActiveGrant(userId: string, locationId: string) {
    const result = await this.hasura.executeQuery<{
      location_delegations: Array<{ id: string }>;
    }>(
      `
      query ActiveGrant($userId: uuid!, $locationId: uuid!) {
        location_delegations(
          where: {
            user_id: { _eq: $userId }
            business_location_id: { _eq: $locationId }
            status: { _eq: "active" }
          }
          limit: 1
        ) { id }
      }
    `,
      { userId, locationId }
    );
    return result.location_delegations?.[0] || null;
  }

  private async consumeInvite(inviteId: string) {
    await this.hasura.executeMutation(
      `
      mutation ConsumeInvite($id: uuid!, $updatedAt: timestamptz!) {
        update_location_delegation_invites_by_pk(
          pk_columns: { id: $id }
          _set: { status: "accepted", updated_at: $updatedAt }
        ) { id }
      }
    `,
      { id: inviteId, updatedAt: new Date().toISOString() }
    );
  }

  private async writeAccepted(userId: string, invite: InvitePreviewRow) {
    const grant = await this.findActiveGrant(userId, invite.business_location_id);
    await this.hasura.executeMutation(
      `
      mutation AcceptEvent($object: location_delegation_events_insert_input!) {
        insert_location_delegation_events_one(object: $object) { id }
      }
    `,
      {
        object: {
          event_type: 'accepted',
          actor_user_id: userId,
          invite_id: invite.id,
          delegation_id: grant?.id ?? null,
          to_role_id: invite.role_id,
        },
      }
    );
  }
}

interface InvitePreviewRow {
  id: string;
  email: string;
  status: string;
  expires_at: string;
  role_id: string;
  first_name?: string | null;
  last_name?: string | null;
  business_location_id: string;
  role?: { id: string; key: string; name: string } | null;
  invited_by?: {
    first_name?: string | null;
    business?: { id?: string | null } | null;
  } | null;
  business_location?: {
    id: string;
    name?: string | null;
    business?: { id: string; name?: string | null } | null;
  } | null;
}
