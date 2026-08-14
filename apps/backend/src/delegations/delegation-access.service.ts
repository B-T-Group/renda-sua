import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type {
  DelegationAccessContext,
  DelegationGrant,
} from './delegation.types';

const GRANT_FIELDS = `
  id
  user_id
  business_location_id
  status
  role {
    id
    key
    name
    role_permissions {
      permission { key }
    }
  }
  business_location {
    id
    name
    business_id
    business { id name }
  }
`;

@Injectable()
export class DelegationAccessService {
  constructor(private readonly hasura: HasuraSystemService) {}

  async listActiveForUser(userId: string): Promise<DelegationGrant[]> {
    const result = await this.hasura.executeQuery<{
      location_delegations: GrantRow[];
    }>(
      `
      query ActiveDelegations($userId: uuid!) {
        location_delegations(
          where: { user_id: { _eq: $userId }, status: { _eq: "active" } }
        ) { ${GRANT_FIELDS} }
      }
    `,
      { userId }
    );
    return (result.location_delegations ?? []).map((row) => this.toGrant(row));
  }

  async resolve(
    userId: string,
    delegationId: string
  ): Promise<DelegationAccessContext> {
    const row = await this.loadActiveGrant(userId, delegationId);
    this.assertLocationStillOwned(row);
    const grant = this.toGrant(row);
    return {
      userId,
      delegationId: grant.id,
      businessId: grant.businessId,
      locationId: grant.locationId,
      role: grant.role,
      permissions: grant.permissions,
    };
  }

  async assertHasPermission(
    ctx: DelegationAccessContext,
    required: string[]
  ): Promise<void> {
    if (!required.length) return;
    const ok = required.some((key) => ctx.permissions.includes(key));
    if (!ok) {
      throw new HttpException(
        'Missing required delegation permission',
        HttpStatus.FORBIDDEN
      );
    }
  }

  private async loadActiveGrant(
    userId: string,
    delegationId: string
  ): Promise<GrantRow> {
    const result = await this.hasura.executeQuery<{
      location_delegations_by_pk: GrantRow | null;
    }>(
      `
      query DelegationByPk($id: uuid!) {
        location_delegations_by_pk(id: $id) { ${GRANT_FIELDS} }
      }
    `,
      { id: delegationId }
    );
    const row = result.location_delegations_by_pk;
    if (!row || row.user_id !== userId || row.status !== 'active') {
      throw new HttpException('Delegation is not active', HttpStatus.FORBIDDEN);
    }
    return row;
  }

  private assertLocationStillOwned(row: GrantRow): void {
    const businessId = row.business_location?.business_id;
    const locationBusiness = row.business_location?.business?.id;
    if (!businessId || !locationBusiness || businessId !== locationBusiness) {
      throw new HttpException(
        'Delegation location is no longer valid',
        HttpStatus.FORBIDDEN
      );
    }
  }

  private toGrant(row: GrantRow): DelegationGrant {
    const permissions = (row.role?.role_permissions ?? [])
      .map((rp) => rp.permission?.key)
      .filter((key): key is string => !!key);
    return {
      id: row.id,
      locationId: row.business_location_id,
      locationName: row.business_location?.name ?? '',
      businessId: row.business_location?.business_id ?? '',
      businessName: row.business_location?.business?.name ?? '',
      role: {
        id: row.role?.id ?? '',
        key: row.role?.key ?? '',
        name: row.role?.name ?? '',
      },
      permissions,
    };
  }
}

interface GrantRow {
  id: string;
  user_id: string;
  business_location_id: string;
  status: string;
  role?: {
    id: string;
    key: string;
    name: string;
    role_permissions?: Array<{ permission?: { key?: string } | null }>;
  } | null;
  business_location?: {
    id: string;
    name?: string | null;
    business_id: string;
    business?: { id: string; name?: string | null } | null;
  } | null;
}
