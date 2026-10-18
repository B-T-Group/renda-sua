import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DelegationAccessService } from '../delegations/delegation-access.service';
import { DELEGATION_PERMISSIONS } from '../delegations/delegation.constants';
import { LocationDelegationsFlagService } from '../delegations/location-delegations-flag.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { DEDICATED_LOCATION_OWNER_QUERY } from './dedicated-assignments.queries';

/** Who is acting on a location's dedicated agents / pickup slots. */
export interface DedicatedLocationActor {
  userId: string;
  locationId: string;
  businessId: string;
  via: 'owner' | 'delegate';
  delegationId?: string;
}

/**
 * Business-side access for #594 location endpoints (`/business-locations/:id/...`):
 * the business owner always passes; a location delegate passes only with an
 * active delegation for that same location (X-Active-Delegation) whose role
 * grants `delegation.dedicated_agents.manage`. Super users use the admin
 * endpoints instead (AdminAuthGuard + platform.manage.agents + geo scope).
 */
@Injectable()
export class DedicatedLocationAccessService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly delegationAccess: DelegationAccessService,
    private readonly delegationsFlag: LocationDelegationsFlagService
  ) {}

  async resolve(locationId: string): Promise<DedicatedLocationActor> {
    const userId = this.hasuraUserService.getUserId();
    if (!userId || userId === 'anonymous') {
      throw new ForbiddenException('Authentication required');
    }
    const res = await this.hasuraSystemService.executeQuery<{
      business_locations_by_pk: { id: string; business_id: string; business: { user_id: string | null } | null } | null;
    }>(DEDICATED_LOCATION_OWNER_QUERY, { locationId });
    const location = res?.business_locations_by_pk;
    if (!location) throw new NotFoundException('Location not found');
    if (location.business?.user_id === userId) {
      return { userId, locationId, businessId: location.business_id, via: 'owner' };
    }

    const delegationId = this.hasuraUserService.resolveContext().activeDelegation?.trim();
    if (!delegationId || !(await this.delegationsFlag.isEnabled())) {
      throw new ForbiddenException('Not allowed to manage this location');
    }
    const grant = await this.delegationAccess.resolve(userId, delegationId);
    if (grant.locationId !== locationId || grant.businessId !== location.business_id) {
      throw new ForbiddenException('Not allowed to manage this location');
    }
    await this.delegationAccess.assertHasPermission(grant, [DELEGATION_PERMISSIONS.DEDICATED_AGENTS_MANAGE]);
    return {
      userId,
      locationId,
      businessId: location.business_id,
      via: 'delegate',
      delegationId: grant.delegationId,
    };
  }
}
