import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as Q from './rental-listing-moderation.queries';

type ModerationStatusFilter = 'pending' | 'rejected' | 'all';

export interface ListingModerationRow {
  id: string;
  moderation_status: string;
  created_at: string;
  base_price_per_hour: number | string;
  rental_item: {
    id: string;
    name: string;
    business: { name: string; user_id: string };
  };
  business_location: { id: string; name: string };
}

type ListingForModerationRow = {
  id: string;
  moderation_status: string;
  deleted_at: string | null;
  rental_item: { name: string; business: { user_id: string } };
};

@Injectable()
export class RentalListingModerationService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly notificationsService: NotificationsService
  ) {}

  async listModerationQueue(params: {
    status?: string;
    page: number;
    limit: number;
  }): Promise<{
    listings: ListingModerationRow[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const limit = Math.min(Math.max(params.limit, 1), 50);
    const page = Math.max(params.page, 1);
    const offset = (page - 1) * limit;
    const where = this.buildModerationWhere(
      this.parseModerationStatusFilter(params.status)
    );
    const result = await this.hasuraSystemService.executeQuery<{
      rental_location_listings: ListingModerationRow[];
      rental_location_listings_aggregate: {
        aggregate: { count: number } | null;
      };
    }>(Q.RENTAL_LISTINGS_MODERATION_LIST, { where, limit, offset });
    return this.toModerationListResult(result, page, limit);
  }

  async approveListing(
    listingId: string,
    moderatorUserId: string
  ): Promise<void> {
    const listing = await this.fetchListingForModeration(listingId);
    this.assertPendingModeration(listing.moderation_status, 'approved');
    await this.runModerationPatch(
      listingId,
      moderatorUserId,
      Q.APPROVE_RENTAL_LISTING_MODERATION
    );
    await this.notificationsService.sendRentalListingApprovedEmail({
      listingId,
      businessUserId: listing.rental_item.business.user_id,
      rentalItemName: listing.rental_item.name,
    });
  }

  async rejectListing(
    listingId: string,
    moderatorUserId: string,
    rejectionReason: string
  ): Promise<void> {
    const listing = await this.fetchListingForModeration(listingId);
    this.assertPendingModeration(listing.moderation_status, 'rejected');
    const ownerUserId = listing.rental_item.business.user_id;
    const trimmed = rejectionReason.trim();
    await this.runModerationPatch(
      listingId,
      moderatorUserId,
      Q.REJECT_RENTAL_LISTING_MODERATION
    );
    await this.insertOwnerMessage(ownerUserId, listingId, trimmed);
    await this.notificationsService.sendRentalListingRejectedEmail({
      listingId,
      businessUserId: ownerUserId,
      rentalItemName: listing.rental_item.name,
      rejectionReason: trimmed,
    });
  }

  private toModerationListResult(
    result: {
      rental_location_listings: ListingModerationRow[];
      rental_location_listings_aggregate: {
        aggregate: { count: number } | null;
      };
    },
    page: number,
    limit: number
  ) {
    const listings = result.rental_location_listings ?? [];
    const total =
      result.rental_location_listings_aggregate?.aggregate?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      listings,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  private parseModerationStatusFilter(raw?: string): ModerationStatusFilter {
    const s = (raw || 'pending').toLowerCase();
    if (s === 'rejected') return 'rejected';
    if (s === 'all') return 'all';
    return 'pending';
  }

  private buildModerationWhere(
    status: ModerationStatusFilter
  ): Record<string, unknown> {
    const base: Record<string, unknown> = {
      deleted_at: { _is_null: true },
      rental_item: { deleted_at: { _is_null: true } },
    };
    if (status === 'all') {
      return {
        _and: [
          base,
          { moderation_status: { _in: ['pending', 'rejected'] } },
        ],
      };
    }
    return {
      _and: [base, { moderation_status: { _eq: status } }],
    };
  }

  private assertPendingModeration(
    status: string,
    action: 'approved' | 'rejected'
  ): void {
    if (status === 'pending') return;
    const verb = action === 'approved' ? 'approved' : 'rejected';
    throw new HttpException(
      `Only listings pending review can be ${verb}`,
      HttpStatus.BAD_REQUEST
    );
  }

  private async fetchListingForModeration(
    listingId: string
  ): Promise<ListingForModerationRow> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_location_listings_by_pk: ListingForModerationRow | null;
    }>(Q.LISTING_FOR_MODERATION_BY_PK, { id: listingId });
    const row = r.rental_location_listings_by_pk;
    if (!row || row.deleted_at) {
      throw new HttpException('Listing not found', HttpStatus.NOT_FOUND);
    }
    return row;
  }

  private async runModerationPatch(
    listingId: string,
    moderatorUserId: string,
    mutation: string
  ): Promise<void> {
    const moderatedAt = new Date().toISOString();
    const result = await this.hasuraSystemService.executeMutation<{
      update_rental_location_listings_by_pk: { id: string } | null;
    }>(mutation, {
      id: listingId,
      moderatedAt,
      moderatorId: moderatorUserId,
    });
    if (!result.update_rental_location_listings_by_pk) {
      throw new HttpException('Update failed', HttpStatus.BAD_REQUEST);
    }
  }

  private async insertOwnerMessage(
    ownerUserId: string,
    listingId: string,
    message: string
  ): Promise<void> {
    const result = await this.hasuraSystemService.executeMutation<{
      insert_user_messages_one: { id: string } | null;
    }>(Q.INSERT_RENTAL_LISTING_REJECTION_MESSAGE, {
      userId: ownerUserId,
      listingId,
      message,
    });
    if (!result.insert_user_messages_one) {
      throw new HttpException(
        'Failed to record rejection message',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
