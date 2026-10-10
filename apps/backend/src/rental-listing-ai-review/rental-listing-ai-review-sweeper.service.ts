import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { cleanupJobBlocksAiReviewSweep } from '../common/ai-review-cleanup-hold';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as Q from './rental-listing-ai-review.queries';

const STALE_MINUTES = 120;
const SWEEP_BATCH = 50;
const SWEEP_REASON = `Stuck in ai_reviewing for over ${STALE_MINUTES} minutes; reset to pending for manual review`;

type StaleListingRow = {
  id: string;
  updated_at: string;
  rental_item?: {
    name?: string | null;
    rental_item_images?: Array<{ id: string }>;
  } | null;
};

type OpenCleanupRow = {
  rental_item_image_id: string;
  job?: { status: string; updated_at?: string | null } | null;
};

@Injectable()
export class RentalListingAiReviewSweeperService {
  private readonly logger = new Logger(RentalListingAiReviewSweeperService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly notifications: NotificationsService
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweepStuckAiReviewing(): Promise<void> {
    try {
      const listings = await this.fetchStaleListings();
      if (!listings.length) return;
      const blocking = await this.fetchBlockingListingIds(listings);
      for (const listing of listings) {
        if (blocking.has(listing.id)) continue;
        await this.resetStaleListing(listing);
      }
    } catch (error: any) {
      this.logger.error(
        `Rental AI reviewing sweeper failed: ${error?.message ?? error}`
      );
    }
  }

  private async fetchStaleListings(): Promise<StaleListingRow[]> {
    const staleBefore = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();
    const result = await this.hasura.executeQuery<{
      rental_location_listings: StaleListingRow[];
    }>(Q.STALE_AI_REVIEWING_LISTINGS, { staleBefore, limit: SWEEP_BATCH });
    return result.rental_location_listings ?? [];
  }

  private async fetchBlockingListingIds(
    listings: StaleListingRow[]
  ): Promise<Set<string>> {
    const imageIds = listings.flatMap((row) => this.imageIds(row));
    if (!imageIds.length) return new Set();
    const open = await this.fetchOpenCleanup(imageIds);
    return this.listingsBlockedByCleanup(listings, open);
  }

  private async fetchOpenCleanup(imageIds: string[]): Promise<OpenCleanupRow[]> {
    const result = await this.hasura.executeQuery<{
      ai_image_cleanup_results: OpenCleanupRow[];
    }>(Q.OPEN_CLEANUP_FOR_RENTAL_IMAGE_IDS, { imageIds });
    return result.ai_image_cleanup_results ?? [];
  }

  private listingsBlockedByCleanup(
    listings: StaleListingRow[],
    open: OpenCleanupRow[]
  ): Set<string> {
    const blockingImages = this.blockingImageIds(open);
    return new Set(
      listings
        .filter((row) => this.imageIds(row).some((id) => blockingImages.has(id)))
        .map((row) => row.id)
    );
  }

  private blockingImageIds(open: OpenCleanupRow[]): Set<string> {
    const now = Date.now();
    return new Set(
      open
        .filter((row) => this.rowBlocksSweep(row, now))
        .map((row) => row.rental_item_image_id)
    );
  }

  private rowBlocksSweep(row: OpenCleanupRow, now: number): boolean {
    if (!row.job) return false;
    return cleanupJobBlocksAiReviewSweep(row.job, now);
  }

  private imageIds(row: StaleListingRow): string[] {
    return (row.rental_item?.rental_item_images ?? []).map((img) => img.id);
  }

  private async resetStaleListing(listing: StaleListingRow): Promise<void> {
    const now = new Date().toISOString();
    await this.hasura.executeMutation(Q.FAIL_RUNNING_AI_REVIEWS_FOR_LISTING, {
      listingId: listing.id,
      decisionReason: SWEEP_REASON,
      completedAt: now,
    });
    const reset = await this.resetIfStillReviewing(listing.id);
    if (!reset) return;
    this.logger.warn(`Swept stuck ai_reviewing listing ${listing.id} to pending`);
    await this.notifySwept(listing);
  }

  private async resetIfStillReviewing(listingId: string): Promise<boolean> {
    const result = await this.hasura.executeMutation<{
      update_rental_location_listings: { affected_rows: number };
    }>(Q.RESET_LISTING_PENDING_IF_AI_REVIEWING, { id: listingId });
    return (result.update_rental_location_listings?.affected_rows ?? 0) > 0;
  }

  private async notifySwept(listing: StaleListingRow): Promise<void> {
    await this.notifications.notifySuperusersListingAiReviewFailed({
      listingId: listing.id,
      listingName: listing.rental_item?.name || listing.id,
      reason: SWEEP_REASON,
    });
  }
}
