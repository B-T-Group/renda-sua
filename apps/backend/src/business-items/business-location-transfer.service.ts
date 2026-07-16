import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { classifyMergeCandidates } from './business-location-transfer-merge.util';
import {
  MergeClassification,
  TransferBusinessOption,
  TransferMode,
  TransferPreview,
  TransferRequestRow,
  TransferRequestStatus,
} from './business-location-transfer.types';

export * from './business-location-transfer.types';

const TRANSFER_TTL_DAYS = 7;
const TERMINAL_ORDER_STATUSES = [
  'delivered',
  'complete',
  'cancelled',
  'failed',
  'refunded',
] as const;
const ACTIVE_RENTAL_STATUSES = [
  'confirmed',
  'active',
  'awaiting_return',
  'proposed',
] as const;

interface LocationContext {
  id: string;
  name: string;
  business_id: string;
  address_id: string;
  is_primary: boolean;
  is_active?: boolean;
  business: {
    id: string;
    name: string;
    user_id: string;
    user: { email: string };
  };
}

interface DestinationBusiness {
  id: string;
  name: string;
  user_id: string;
  user: { email: string };
}

interface TransferableIds {
  itemIds: string[];
  rentalItemIds: string[];
  listingIds: string[];
}

@Injectable()
export class BusinessLocationTransferService {
  private readonly logger = new Logger(BusinessLocationTransferService.name);

  constructor(
    private readonly hasuraSystem: HasuraSystemService,
    private readonly notifications: NotificationsService
  ) {}

  async searchBusinesses(
    query: string,
    excludeBusinessId: string
  ): Promise<TransferBusinessOption[]> {
    const pattern = `%${query.trim()}%`;
    const result = await this.hasuraSystem.executeQuery<{
      businesses: Array<{
        id: string;
        name: string;
        user: { email: string };
      }>;
    }>(
      `
      query SearchBusinesses($where: businesses_bool_exp!, $limit: Int!) {
        businesses(where: $where, limit: $limit, order_by: { name: asc }) {
          id
          name
          user { email }
        }
      }
    `,
      {
        where: {
          id: { _neq: excludeBusinessId },
          _or: [
            { name: { _ilike: pattern } },
            { user: { email: { _ilike: pattern } } },
          ],
        },
        limit: 20,
      }
    );
    return (result.businesses || []).map((b) => ({
      id: b.id,
      name: b.name,
      email: b.user?.email || '',
    }));
  }

  async listActiveLocationsForBusiness(
    businessId: string
  ): Promise<Array<{ id: string; name: string }>> {
    const result = await this.hasuraSystem.executeQuery<{
      business_locations: Array<{ id: string; name: string }>;
    }>(
      `
      query DestLocations($businessId: uuid!) {
        business_locations(
          where: { business_id: { _eq: $businessId }, is_active: { _eq: true } }
          order_by: { name: asc }
        ) { id name }
      }
    `,
      { businessId }
    );
    return result.business_locations || [];
  }

  async preview(
    locationId: string,
    toBusinessId: string,
    sourceBusinessId: string,
    options?: { mode?: TransferMode; toLocationId?: string }
  ): Promise<TransferPreview> {
    const mode = options?.mode ?? 'location_ownership';
    if (mode === 'inventory_merge') {
      return this.previewInventoryMerge(
        locationId,
        toBusinessId,
        sourceBusinessId,
        options?.toLocationId
      );
    }
    return this.previewOwnership(locationId, toBusinessId, sourceBusinessId);
  }

  async createRequest(params: {
    locationId: string;
    toBusinessId: string;
    confirmBusinessName: string;
    sourceBusinessId: string;
    requestedByUserId: string;
    mode?: TransferMode;
    toLocationId?: string;
  }): Promise<TransferRequestRow> {
    await this.expireStaleRequests();
    const mode = params.mode ?? 'location_ownership';
    const preview = await this.preview(
      params.locationId,
      params.toBusinessId,
      params.sourceBusinessId,
      { mode, toLocationId: params.toLocationId }
    );
    this.assertCanTransfer(preview);
    this.assertNameMatches(params.confirmBusinessName, preview.toBusiness.name);
    const mergeClassification =
      mode === 'inventory_merge'
        ? await this.buildMergeClassification(
            params.locationId,
            params.toBusinessId
          )
        : null;
    await this.assertNoPendingRequest(params.locationId);
    const location = await this.loadLocation(params.locationId);
    const destination = await this.loadBusiness(params.toBusinessId);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TRANSFER_TTL_DAYS);
    const row = await this.insertRequest({
      location,
      destination,
      requestedByUserId: params.requestedByUserId,
      itemCount:
        mode === 'inventory_merge'
          ? mergeClassification!.movableItemIds.length
          : preview.itemCount,
      rentalItemCount:
        mode === 'inventory_merge'
          ? mergeClassification!.movableRentalItemIds.length
          : preview.rentalItemCount,
      orderCount: preview.completedOrderCount,
      expiresAt: expiresAt.toISOString(),
      mode,
      toLocationId: params.toLocationId,
      toLocationName: preview.toLocation?.name,
      skippedDuplicates:
        mergeClassification?.skippedDuplicates ?? preview.skippedDuplicates,
      skippedShared: mergeClassification?.skippedShared ?? preview.skippedShared,
      movedItemIds: mergeClassification?.movableItemIds ?? [],
      movedRentalItemIds: mergeClassification?.movableRentalItemIds ?? [],
      movedListingIds: mergeClassification?.movableListingIds ?? [],
    });
    void this.notifyDestination(row, location.name, location.business.name);
    return row;
  }

  async listPendingForBusiness(businessId: string): Promise<{
    incoming: TransferRequestRow[];
    outgoing: TransferRequestRow[];
  }> {
    await this.expireStaleRequests();
    const result = await this.hasuraSystem.executeQuery<{
      incoming: TransferRequestRow[];
      outgoing: TransferRequestRow[];
    }>(
      `
      query PendingTransfers($businessId: uuid!) {
        incoming: business_location_transfer_requests(
          where: { to_business_id: { _eq: $businessId }, status: { _eq: pending } }
          order_by: { created_at: desc }
        ) { ${this.requestSelection()} }
        outgoing: business_location_transfer_requests(
          where: { from_business_id: { _eq: $businessId }, status: { _eq: pending } }
          order_by: { created_at: desc }
        ) { ${this.requestSelection()} }
      }
    `,
      { businessId }
    );
    return {
      incoming: result.incoming || [],
      outgoing: result.outgoing || [],
    };
  }

  async listAllAdmin(params: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
  }): Promise<{
    items: TransferRequestRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.expireStaleRequests();
    const offset = (params.page - 1) * params.limit;
    const where = this.buildAdminWhere(params.status, params.search);
    const result = await this.hasuraSystem.executeQuery<{
      business_location_transfer_requests: TransferRequestRow[];
      business_location_transfer_requests_aggregate: {
        aggregate: { count: number };
      };
    }>(
      `
      query AdminTransfers($where: business_location_transfer_requests_bool_exp!, $limit: Int!, $offset: Int!) {
        business_location_transfer_requests(
          where: $where, limit: $limit, offset: $offset, order_by: { created_at: desc }
        ) { ${this.requestSelection()} }
        business_location_transfer_requests_aggregate(where: $where) {
          aggregate { count }
        }
      }
    `,
      { where, limit: params.limit, offset }
    );
    return {
      items: result.business_location_transfer_requests || [],
      total:
        result.business_location_transfer_requests_aggregate?.aggregate
          ?.count || 0,
      page: params.page,
      limit: params.limit,
    };
  }

  async accept(
    requestId: string,
    destinationBusinessId: string
  ): Promise<TransferRequestRow> {
    const request = await this.loadRequest(requestId);
    this.assertPendingActive(request);
    if (request.to_business_id !== destinationBusinessId) {
      throw new HttpException(
        { success: false, error: 'Only the destination business can accept' },
        HttpStatus.FORBIDDEN
      );
    }
    const mode = request.transfer_mode ?? 'location_ownership';
    const location = await this.loadLocation(request.business_location_id);
    if (mode === 'inventory_merge') {
      if (request.to_business_location_id) {
        await this.loadDestLocation(
          request.to_business_location_id,
          request.to_business_id
        );
      }
      const classification = this.mergeClassificationFromRequest(request);
      const blockReasons = await this.collectMergeBlockReasons(
        location,
        request.to_business_id,
        classification
      );
      this.assertNoBlockReasons(blockReasons);
      await this.executeInventoryMerge(request, location, classification);
    } else {
      const preview = await this.preview(
        request.business_location_id,
        request.to_business_id,
        request.from_business_id,
        { mode }
      );
      this.assertCanTransfer(preview);
      const ids = await this.loadTransferableIds(location.id);
      await this.executeOwnershipTransfer(request, location, ids);
    }
    const updated = await this.loadRequest(requestId);
    void this.notifyRequester(request, 'accepted', location.name);
    return updated;
  }

  async reject(
    requestId: string,
    destinationBusinessId: string
  ): Promise<TransferRequestRow> {
    const request = await this.loadRequest(requestId);
    this.assertPendingActive(request);
    if (request.to_business_id !== destinationBusinessId) {
      throw new HttpException(
        { success: false, error: 'Only the destination business can reject' },
        HttpStatus.FORBIDDEN
      );
    }
    await this.setRequestStatus(requestId, 'rejected');
    void this.notifyRequester(request, 'rejected', '');
    return this.loadRequest(requestId);
  }

  async cancel(
    requestId: string,
    actor: { businessId?: string; isAdmin: boolean; userId: string }
  ): Promise<TransferRequestRow> {
    const request = await this.loadRequest(requestId);
    this.assertPendingActive(request);
    const isSource =
      actor.businessId && request.from_business_id === actor.businessId;
    const isRequester = request.requested_by_user_id === actor.userId;
    if (!actor.isAdmin && !isSource && !isRequester) {
      throw new HttpException(
        { success: false, error: 'Not allowed to cancel this request' },
        HttpStatus.FORBIDDEN
      );
    }
    await this.setRequestStatus(requestId, 'cancelled');
    const locationName =
      request.business_location?.name ||
      String(request.metadata?.locationName || '');
    void this.notifyDestinationOfCancel(request, locationName);
    return this.loadRequest(requestId);
  }

  async getForBusiness(
    requestId: string,
    businessId: string
  ): Promise<TransferRequestRow> {
    await this.expireStaleRequests();
    const request = await this.loadRequest(requestId);
    if (
      request.from_business_id !== businessId &&
      request.to_business_id !== businessId
    ) {
      throw new HttpException(
        { success: false, error: 'Transfer request not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return request;
  }

  private async previewOwnership(
    locationId: string,
    toBusinessId: string,
    sourceBusinessId: string
  ): Promise<TransferPreview> {
    const location = await this.loadLocation(locationId);
    this.assertLocationBelongsTo(location, sourceBusinessId);
    const destination = await this.loadBusiness(toBusinessId);
    const ids = await this.loadTransferableIds(locationId);
    const blockReasons = await this.collectOwnershipBlockReasons(
      location,
      destination,
      sourceBusinessId,
      ids
    );
    const orderCount = await this.countOrdersAtLocation(locationId);
    const completedOrderCount = await this.countCompletedOrders(locationId);
    return this.buildPreviewBase({
      location,
      destination,
      mode: 'location_ownership',
      ids,
      classification: null,
      orderCount,
      completedOrderCount,
      blockReasons,
    });
  }

  private async previewInventoryMerge(
    locationId: string,
    toBusinessId: string,
    sourceBusinessId: string,
    toLocationId?: string
  ): Promise<TransferPreview> {
    const location = await this.loadLocation(locationId);
    this.assertLocationBelongsTo(location, sourceBusinessId);
    const destination = await this.loadBusiness(toBusinessId);
    if (!toLocationId) {
      throw new HttpException(
        {
          success: false,
          error: 'Destination location is required for inventory merge',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    const toLocation = await this.loadDestLocation(toLocationId, toBusinessId);
    const ids = await this.loadTransferableIds(locationId);
    const classification = await this.buildMergeClassification(
      locationId,
      toBusinessId
    );
    const blockReasons = await this.collectMergeBlockReasons(
      location,
      destination.id,
      classification
    );
    const orderCount = await this.countOrdersAtLocation(locationId);
    const completedOrderCount = await this.countCompletedOrders(locationId);
    return this.buildPreviewBase({
      location,
      destination,
      mode: 'inventory_merge',
      ids,
      classification,
      orderCount,
      completedOrderCount,
      blockReasons,
      toLocation,
    });
  }

  private buildPreviewBase(params: {
    location: LocationContext;
    destination: DestinationBusiness;
    mode: TransferMode;
    ids: TransferableIds;
    classification: MergeClassification | null;
    orderCount: number;
    completedOrderCount: number;
    blockReasons: string[];
    toLocation?: { id: string; name: string };
  }): TransferPreview {
    const movableItemCount =
      params.classification?.movableItemIds.length ?? params.ids.itemIds.length;
    const movableRentalItemCount =
      params.classification?.movableRentalItemIds.length ??
      params.ids.rentalItemIds.length;
    const skippedDuplicates = params.classification?.skippedDuplicates ?? [];
    const skippedShared = params.classification?.skippedShared ?? [];
    const canTransfer =
      params.blockReasons.length === 0 &&
      (params.mode === 'location_ownership' ||
        movableItemCount + movableRentalItemCount > 0);
    return {
      locationId: params.location.id,
      locationName: params.location.name,
      fromBusiness: this.toBusinessOption(params.location.business),
      toBusiness: this.toBusinessOption(params.destination),
      mode: params.mode,
      toLocation: params.toLocation ?? null,
      itemCount: params.ids.itemIds.length,
      rentalItemCount: params.ids.rentalItemIds.length,
      movableItemCount,
      movableRentalItemCount,
      skippedDuplicateCount: skippedDuplicates.length,
      skippedSharedCount: skippedShared.length,
      skippedDuplicates,
      skippedShared,
      orderCount: params.orderCount,
      completedOrderCount: params.completedOrderCount,
      canTransfer,
      blockReasons: params.blockReasons,
    };
  }

  private async executeOwnershipTransfer(
    request: TransferRequestRow,
    location: LocationContext,
    ids: TransferableIds
  ): Promise<void> {
    const mutation = `
      mutation AcceptLocationTransfer(
        $requestId: uuid!
        $locationId: uuid!
        $toBusinessId: uuid!
        $fromBusinessId: uuid!
        $toUserId: uuid!
        $addressId: uuid!
        $itemIds: [uuid!]!
        $rentalItemIds: [uuid!]!
        $listingIds: [uuid!]!
        $now: timestamptz!
      ) {
        update_business_location_transfer_requests(
          where: { id: { _eq: $requestId }, status: { _eq: pending } }
          _set: { status: accepted, responded_at: $now }
        ) { affected_rows }
        update_business_locations_by_pk(
          pk_columns: { id: $locationId }
          _set: { business_id: $toBusinessId, is_primary: false }
        ) { id }
        update_business_addresses(
          where: { address_id: { _eq: $addressId } }
          _set: { business_id: $toBusinessId }
        ) { affected_rows }
        update_items(
          where: { id: { _in: $itemIds } }
          _set: { business_id: $toBusinessId }
        ) { affected_rows }
        update_item_images(
          where: { item_id: { _in: $itemIds } }
          _set: { business_id: $toBusinessId }
        ) { affected_rows }
        update_rental_items(
          where: { id: { _in: $rentalItemIds } }
          _set: { business_id: $toBusinessId }
        ) { affected_rows }
        update_rental_item_images(
          where: { rental_item_id: { _in: $rentalItemIds } }
          _set: { business_id: $toBusinessId }
        ) { affected_rows }
        update_orders(
          where: { business_location_id: { _eq: $locationId } }
          _set: { business_id: $toBusinessId }
        ) { affected_rows }
        update_order_refund_requests(
          where: { order: { business_location_id: { _eq: $locationId } } }
          _set: { business_id: $toBusinessId }
        ) { affected_rows }
        update_rental_bookings(
          where: { rental_location_listing_id: { _in: $listingIds } }
          _set: { business_id: $toBusinessId }
        ) { affected_rows }
        update_accounts(
          where: { business_location_id: { _eq: $locationId } }
          _set: { user_id: $toUserId }
        ) { affected_rows }
        delete_business_item_favorites(
          where: {
            item_id: { _in: $itemIds }
            business_id: { _eq: $fromBusinessId }
          }
        ) { affected_rows }
      }
    `;
    const result = await this.hasuraSystem.executeMutation<{
      update_business_location_transfer_requests: { affected_rows: number };
    }>(mutation, {
      requestId: request.id,
      locationId: location.id,
      toBusinessId: request.to_business_id,
      fromBusinessId: request.from_business_id,
      toUserId: request.to_user_id,
      addressId: location.address_id,
      itemIds: ids.itemIds,
      rentalItemIds: ids.rentalItemIds,
      listingIds: ids.listingIds,
      now: new Date().toISOString(),
    });
    this.assertAcceptApplied(result);
  }

  private async executeInventoryMerge(
    request: TransferRequestRow,
    location: LocationContext,
    classification: MergeClassification
  ): Promise<void> {
    const toLocationId = request.to_business_location_id;
    if (!toLocationId) {
      throw new HttpException(
        { success: false, error: 'Missing destination location on request' },
        HttpStatus.BAD_REQUEST
      );
    }
    const metadata = {
      ...(request.metadata || {}),
      skippedDuplicates: classification.skippedDuplicates,
      skippedShared: classification.skippedShared,
      movedItemIds: classification.movableItemIds,
      movedRentalItemIds: classification.movableRentalItemIds,
      movedListingIds: classification.movableListingIds,
      movedInventoryCount: classification.movableItemIds.length,
    };
    const mutation = `
      mutation AcceptInventoryMerge(
        $requestId: uuid!
        $toBusinessId: uuid!
        $fromBusinessId: uuid!
        $sourceLocationId: uuid!
        $toLocationId: uuid!
        $itemIds: [uuid!]!
        $rentalItemIds: [uuid!]!
        $listingIds: [uuid!]!
        $metadata: jsonb!
        $now: timestamptz!
      ) {
        update_business_location_transfer_requests(
          where: { id: { _eq: $requestId }, status: { _eq: pending } }
          _set: { status: accepted, responded_at: $now, metadata: $metadata }
        ) { affected_rows }
        update_items(
          where: { id: { _in: $itemIds } }
          _set: { business_id: $toBusinessId }
        ) { affected_rows }
        update_item_images(
          where: { item_id: { _in: $itemIds } }
          _set: { business_id: $toBusinessId }
        ) { affected_rows }
        update_business_inventory(
          where: {
            business_location_id: { _eq: $sourceLocationId }
            item_id: { _in: $itemIds }
          }
          _set: { business_location_id: $toLocationId }
        ) { affected_rows }
        update_rental_items(
          where: { id: { _in: $rentalItemIds } }
          _set: { business_id: $toBusinessId }
        ) { affected_rows }
        update_rental_item_images(
          where: { rental_item_id: { _in: $rentalItemIds } }
          _set: { business_id: $toBusinessId }
        ) { affected_rows }
        update_rental_location_listings(
          where: { id: { _in: $listingIds } }
          _set: { business_location_id: $toLocationId }
        ) { affected_rows }
        delete_business_item_favorites(
          where: {
            item_id: { _in: $itemIds }
            business_id: { _eq: $fromBusinessId }
          }
        ) { affected_rows }
      }
    `;
    const result = await this.hasuraSystem.executeMutation<{
      update_business_location_transfer_requests: { affected_rows: number };
    }>(mutation, {
      requestId: request.id,
      toBusinessId: request.to_business_id,
      fromBusinessId: request.from_business_id,
      sourceLocationId: location.id,
      toLocationId,
      itemIds: classification.movableItemIds,
      rentalItemIds: classification.movableRentalItemIds,
      listingIds: classification.movableListingIds,
      metadata,
      now: new Date().toISOString(),
    });
    this.assertAcceptApplied(result);
  }

  private assertAcceptApplied(result: {
    update_business_location_transfer_requests?: { affected_rows: number };
  }): void {
    if (
      result.update_business_location_transfer_requests?.affected_rows !== 1
    ) {
      throw new HttpException(
        { success: false, error: 'Transfer request is no longer pending' },
        HttpStatus.CONFLICT
      );
    }
  }

  private async collectOwnershipBlockReasons(
    location: LocationContext,
    destination: DestinationBusiness,
    sourceBusinessId: string,
    ids: TransferableIds
  ): Promise<string[]> {
    const reasons: string[] = [];
    if (destination.id === sourceBusinessId) {
      reasons.push('DESTINATION_SAME_AS_SOURCE');
    }
    if (location.is_primary) reasons.push('PRIMARY_LOCATION');
    if ((await this.countLocations(sourceBusinessId)) <= 1) {
      reasons.push('ONLY_LOCATION');
    }
    if (await this.hasSharedItems(location.id, ids.itemIds)) {
      reasons.push('ITEMS_USED_IN_OTHER_LOCATIONS');
    }
    if (await this.hasSharedRentals(location.id, ids.rentalItemIds)) {
      reasons.push('RENTALS_USED_IN_OTHER_LOCATIONS');
    }
    if (await this.hasOngoingOrders(location.id)) {
      reasons.push('ONGOING_ORDERS');
    }
    if (await this.hasOngoingRentals(ids.listingIds)) {
      reasons.push('ONGOING_RENTALS');
    }
    if (await this.hasSkuCollision(ids.itemIds, destination.id)) {
      reasons.push('SKU_COLLISION');
    }
    return reasons;
  }

  private async collectMergeBlockReasons(
    location: LocationContext,
    destinationBusinessId: string,
    classification: MergeClassification
  ): Promise<string[]> {
    const reasons: string[] = [];
    if (destinationBusinessId === location.business_id) {
      reasons.push('DESTINATION_SAME_AS_SOURCE');
    }
    if (await this.hasOngoingOrders(location.id)) {
      reasons.push('ONGOING_ORDERS');
    }
    if (await this.hasOngoingRentals(classification.movableListingIds)) {
      reasons.push('ONGOING_RENTALS');
    }
    if (
      classification.movableItemIds.length +
        classification.movableRentalItemIds.length ===
      0
    ) {
      reasons.push('NO_MOVABLE_INVENTORY');
    }
    return reasons;
  }

  private mergeClassificationFromRequest(
    request: TransferRequestRow
  ): MergeClassification {
    const metadata = request.metadata || {};
    return {
      movableItemIds: this.stringArray(metadata.movedItemIds),
      movableRentalItemIds: this.stringArray(metadata.movedRentalItemIds),
      movableListingIds: this.stringArray(metadata.movedListingIds),
      skippedDuplicates: Array.isArray(metadata.skippedDuplicates)
        ? metadata.skippedDuplicates
        : [],
      skippedShared: Array.isArray(metadata.skippedShared)
        ? metadata.skippedShared
        : [],
    };
  }

  private stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === 'string');
  }

  private async buildMergeClassification(
    locationId: string,
    destinationBusinessId: string
  ): Promise<MergeClassification> {
    const [items, rentals, destSkus, destRentalNames] = await Promise.all([
      this.loadSourceItemCandidates(locationId),
      this.loadSourceRentalCandidates(locationId),
      this.loadDestSkuSet(destinationBusinessId),
      this.loadDestRentalNameSet(destinationBusinessId),
    ]);
    return classifyMergeCandidates({
      items,
      rentals,
      destSkuSet: destSkus,
      destRentalNameSet: destRentalNames,
    });
  }

  private async loadSourceItemCandidates(locationId: string) {
    const result = await this.hasuraSystem.executeQuery<{
      business_inventory: Array<{
        item_id: string;
        item: { id: string; name: string; sku: string | null };
      }>;
    }>(
      `
      query SourceItems($locationId: uuid!) {
        business_inventory(where: { business_location_id: { _eq: $locationId } }) {
          item_id
          item { id name sku }
        }
      }
    `,
      { locationId }
    );
    const byId = new Map<
      string,
      { id: string; name: string; sku: string | null }
    >();
    for (const row of result.business_inventory || []) {
      if (row.item) byId.set(row.item.id, row.item);
    }
    const itemIds = [...byId.keys()];
    const sharedIds = await this.loadSharedItemIds(locationId, itemIds);
    return itemIds.map((id) => {
      const item = byId.get(id)!;
      return {
        id: item.id,
        name: item.name,
        sku: item.sku,
        sharedElsewhere: sharedIds.has(id),
      };
    });
  }

  private async loadSourceRentalCandidates(locationId: string) {
    const result = await this.hasuraSystem.executeQuery<{
      rental_location_listings: Array<{
        id: string;
        rental_item_id: string;
        rental_item: { id: string; name: string };
      }>;
    }>(
      `
      query SourceRentals($locationId: uuid!) {
        rental_location_listings(where: { business_location_id: { _eq: $locationId } }) {
          id
          rental_item_id
          rental_item { id name }
        }
      }
    `,
      { locationId }
    );
    const listings = result.rental_location_listings || [];
    const rentalItemIds = [
      ...new Set(listings.map((l) => l.rental_item_id)),
    ];
    const sharedIds = await this.loadSharedRentalIds(locationId, rentalItemIds);
    return listings.map((l) => ({
      id: l.rental_item.id,
      name: l.rental_item.name,
      listingId: l.id,
      sharedElsewhere: sharedIds.has(l.rental_item_id),
    }));
  }

  private async loadSharedItemIds(
    locationId: string,
    itemIds: string[]
  ): Promise<Set<string>> {
    if (!itemIds.length) return new Set();
    const result = await this.hasuraSystem.executeQuery<{
      business_inventory: Array<{ item_id: string }>;
    }>(
      `
      query SharedItemIds($itemIds: [uuid!]!, $locationId: uuid!) {
        business_inventory(
          where: {
            item_id: { _in: $itemIds }
            business_location_id: { _neq: $locationId }
          }
        ) { item_id }
      }
    `,
      { itemIds, locationId }
    );
    return new Set((result.business_inventory || []).map((r) => r.item_id));
  }

  private async loadSharedRentalIds(
    locationId: string,
    rentalItemIds: string[]
  ): Promise<Set<string>> {
    if (!rentalItemIds.length) return new Set();
    const result = await this.hasuraSystem.executeQuery<{
      rental_location_listings: Array<{ rental_item_id: string }>;
    }>(
      `
      query SharedRentalIds($rentalItemIds: [uuid!]!, $locationId: uuid!) {
        rental_location_listings(
          where: {
            rental_item_id: { _in: $rentalItemIds }
            business_location_id: { _neq: $locationId }
          }
        ) { rental_item_id }
      }
    `,
      { rentalItemIds, locationId }
    );
    return new Set(
      (result.rental_location_listings || []).map((r) => r.rental_item_id)
    );
  }

  private async loadDestSkuSet(businessId: string): Promise<Set<string>> {
    const result = await this.hasuraSystem.executeQuery<{
      items: Array<{ sku: string | null }>;
    }>(
      `
      query DestSkus($businessId: uuid!) {
        items(where: { business_id: { _eq: $businessId }, sku: { _is_null: false } }) {
          sku
        }
      }
    `,
      { businessId }
    );
    return new Set(
      (result.items || [])
        .map((i) => i.sku?.trim().toLowerCase())
        .filter((s): s is string => !!s)
    );
  }

  private async loadDestRentalNameSet(
    businessId: string
  ): Promise<Set<string>> {
    const result = await this.hasuraSystem.executeQuery<{
      rental_items: Array<{ name: string }>;
    }>(
      `
      query DestRentalNames($businessId: uuid!) {
        rental_items(where: { business_id: { _eq: $businessId } }) { name }
      }
    `,
      { businessId }
    );
    return new Set(
      (result.rental_items || [])
        .map((r) => r.name.trim().toLowerCase())
        .filter(Boolean)
    );
  }

  private async loadTransferableIds(
    locationId: string
  ): Promise<TransferableIds> {
    const result = await this.hasuraSystem.executeQuery<{
      business_inventory: Array<{ item_id: string }>;
      rental_location_listings: Array<{
        id: string;
        rental_item_id: string;
      }>;
    }>(
      `
      query TransferableIds($locationId: uuid!) {
        business_inventory(where: { business_location_id: { _eq: $locationId } }) {
          item_id
        }
        rental_location_listings(where: { business_location_id: { _eq: $locationId } }) {
          id
          rental_item_id
        }
      }
    `,
      { locationId }
    );
    const itemIds = [
      ...new Set((result.business_inventory || []).map((r) => r.item_id)),
    ];
    const listingIds = (result.rental_location_listings || []).map((r) => r.id);
    const rentalItemIds = [
      ...new Set(
        (result.rental_location_listings || []).map((r) => r.rental_item_id)
      ),
    ];
    return { itemIds, rentalItemIds, listingIds };
  }

  private async hasSharedItems(
    locationId: string,
    itemIds: string[]
  ): Promise<boolean> {
    const shared = await this.loadSharedItemIds(locationId, itemIds);
    return shared.size > 0;
  }

  private async hasSharedRentals(
    locationId: string,
    rentalItemIds: string[]
  ): Promise<boolean> {
    const shared = await this.loadSharedRentalIds(locationId, rentalItemIds);
    return shared.size > 0;
  }

  private async hasOngoingOrders(locationId: string): Promise<boolean> {
    const result = await this.hasuraSystem.executeQuery<{
      orders_aggregate: { aggregate: { count: number } };
    }>(
      `
      query OngoingOrders($locationId: uuid!, $terminal: [order_status!]!) {
        orders_aggregate(
          where: {
            business_location_id: { _eq: $locationId }
            current_status: { _nin: $terminal }
          }
        ) { aggregate { count } }
      }
    `,
      { locationId, terminal: [...TERMINAL_ORDER_STATUSES] }
    );
    return (result.orders_aggregate?.aggregate?.count || 0) > 0;
  }

  private async hasOngoingRentals(listingIds: string[]): Promise<boolean> {
    if (!listingIds.length) return false;
    const result = await this.hasuraSystem.executeQuery<{
      rental_bookings_aggregate: { aggregate: { count: number } };
    }>(
      `
      query OngoingRentals($listingIds: [uuid!]!, $active: [rental_booking_status_enum!]!) {
        rental_bookings_aggregate(
          where: {
            rental_location_listing_id: { _in: $listingIds }
            status: { _in: $active }
          }
        ) { aggregate { count } }
      }
    `,
      { listingIds, active: [...ACTIVE_RENTAL_STATUSES] }
    );
    return (result.rental_bookings_aggregate?.aggregate?.count || 0) > 0;
  }

  private async hasSkuCollision(
    itemIds: string[],
    destinationBusinessId: string
  ): Promise<boolean> {
    if (!itemIds.length) return false;
    const source = await this.hasuraSystem.executeQuery<{
      items: Array<{ sku: string | null }>;
    }>(
      `
      query SourceSkus($itemIds: [uuid!]!) {
        items(where: { id: { _in: $itemIds }, sku: { _is_null: false } }) {
          sku
        }
      }
    `,
      { itemIds }
    );
    const skus = (source.items || [])
      .map((i) => i.sku)
      .filter((s): s is string => !!s);
    if (!skus.length) return false;
    const dest = await this.hasuraSystem.executeQuery<{
      items_aggregate: { aggregate: { count: number } };
    }>(
      `
      query DestSkus($businessId: uuid!, $skus: [String!]!) {
        items_aggregate(
          where: { business_id: { _eq: $businessId }, sku: { _in: $skus } }
        ) { aggregate { count } }
      }
    `,
      { businessId: destinationBusinessId, skus }
    );
    return (dest.items_aggregate?.aggregate?.count || 0) > 0;
  }

  private async countOrdersAtLocation(locationId: string): Promise<number> {
    const result = await this.hasuraSystem.executeQuery<{
      orders_aggregate: { aggregate: { count: number } };
    }>(
      `
      query CountOrders($locationId: uuid!) {
        orders_aggregate(where: { business_location_id: { _eq: $locationId } }) {
          aggregate { count }
        }
      }
    `,
      { locationId }
    );
    return result.orders_aggregate?.aggregate?.count || 0;
  }

  private async countCompletedOrders(locationId: string): Promise<number> {
    const result = await this.hasuraSystem.executeQuery<{
      orders_aggregate: { aggregate: { count: number } };
    }>(
      `
      query CountCompleted($locationId: uuid!, $terminal: [order_status!]!) {
        orders_aggregate(
          where: {
            business_location_id: { _eq: $locationId }
            current_status: { _in: $terminal }
          }
        ) { aggregate { count } }
      }
    `,
      { locationId, terminal: [...TERMINAL_ORDER_STATUSES] }
    );
    return result.orders_aggregate?.aggregate?.count || 0;
  }

  private async countLocations(businessId: string): Promise<number> {
    const result = await this.hasuraSystem.executeQuery<{
      business_locations_aggregate: { aggregate: { count: number } };
    }>(
      `
      query CountLocations($businessId: uuid!) {
        business_locations_aggregate(where: { business_id: { _eq: $businessId } }) {
          aggregate { count }
        }
      }
    `,
      { businessId }
    );
    return result.business_locations_aggregate?.aggregate?.count || 0;
  }

  private async loadLocation(locationId: string): Promise<LocationContext> {
    const result = await this.hasuraSystem.executeQuery<{
      business_locations_by_pk: LocationContext | null;
    }>(
      `
      query GetLocation($id: uuid!) {
        business_locations_by_pk(id: $id) {
          id name business_id address_id is_primary is_active
          business {
            id name user_id
            user { email }
          }
        }
      }
    `,
      { id: locationId }
    );
    const location = result.business_locations_by_pk;
    if (!location) {
      throw new HttpException(
        { success: false, error: 'Location not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return location;
  }

  private async loadDestLocation(
    locationId: string,
    businessId: string
  ): Promise<{ id: string; name: string }> {
    const location = await this.loadLocation(locationId);
    if (location.business_id !== businessId || location.is_active === false) {
      throw new HttpException(
        {
          success: false,
          error: 'Destination location is invalid for this business',
          code: 'INVALID_DEST_LOCATION',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return { id: location.id, name: location.name };
  }

  private async loadBusiness(businessId: string): Promise<DestinationBusiness> {
    const result = await this.hasuraSystem.executeQuery<{
      businesses_by_pk: DestinationBusiness | null;
    }>(
      `
      query GetBusiness($id: uuid!) {
        businesses_by_pk(id: $id) {
          id name user_id
          user { email }
        }
      }
    `,
      { id: businessId }
    );
    const business = result.businesses_by_pk;
    if (!business) {
      throw new HttpException(
        { success: false, error: 'Destination business not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return business;
  }

  private async loadRequest(requestId: string): Promise<TransferRequestRow> {
    const result = await this.hasuraSystem.executeQuery<{
      business_location_transfer_requests_by_pk: TransferRequestRow | null;
    }>(
      `
      query GetTransferRequest($id: uuid!) {
        business_location_transfer_requests_by_pk(id: $id) {
          ${this.requestSelection()}
        }
      }
    `,
      { id: requestId }
    );
    const row = result.business_location_transfer_requests_by_pk;
    if (!row) {
      throw new HttpException(
        { success: false, error: 'Transfer request not found' },
        HttpStatus.NOT_FOUND
      );
    }
    return row;
  }

  private async insertRequest(params: {
    location: LocationContext;
    destination: DestinationBusiness;
    requestedByUserId: string;
    itemCount: number;
    rentalItemCount: number;
    orderCount: number;
    expiresAt: string;
    mode: TransferMode;
    toLocationId?: string;
    toLocationName?: string;
    skippedDuplicates: TransferPreview['skippedDuplicates'];
    skippedShared: TransferPreview['skippedShared'];
    movedItemIds: string[];
    movedRentalItemIds: string[];
    movedListingIds: string[];
  }): Promise<TransferRequestRow> {
    const result = await this.hasuraSystem.executeMutation<{
      insert_business_location_transfer_requests_one: TransferRequestRow;
    }>(
      `
      mutation InsertTransferRequest($object: business_location_transfer_requests_insert_input!) {
        insert_business_location_transfer_requests_one(object: $object) {
          ${this.requestSelection()}
        }
      }
    `,
      {
        object: {
          business_location_id: params.location.id,
          from_business_id: params.location.business_id,
          to_business_id: params.destination.id,
          to_business_location_id:
            params.mode === 'inventory_merge' ? params.toLocationId : null,
          transfer_mode: params.mode,
          from_user_id: params.location.business.user_id,
          to_user_id: params.destination.user_id,
          requested_by_user_id: params.requestedByUserId,
          status: 'pending',
          item_count: params.itemCount,
          rental_item_count: params.rentalItemCount,
          order_count: params.orderCount,
          metadata: {
            locationName: params.location.name,
            fromBusinessName: params.location.business.name,
            toBusinessName: params.destination.name,
            toLocationName: params.toLocationName,
            skippedDuplicates: params.skippedDuplicates,
            skippedShared: params.skippedShared,
            movedItemIds: params.movedItemIds,
            movedRentalItemIds: params.movedRentalItemIds,
            movedListingIds: params.movedListingIds,
          },
          expires_at: params.expiresAt,
        },
      }
    );
    return result.insert_business_location_transfer_requests_one;
  }

  private async setRequestStatus(
    requestId: string,
    status: TransferRequestStatus
  ): Promise<void> {
    await this.hasuraSystem.executeMutation(
      `
      mutation SetTransferStatus($id: uuid!, $status: business_location_transfer_status!, $now: timestamptz!) {
        update_business_location_transfer_requests_by_pk(
          pk_columns: { id: $id }
          _set: { status: $status, responded_at: $now }
        ) { id }
      }
    `,
      { id: requestId, status, now: new Date().toISOString() }
    );
  }

  private async assertNoPendingRequest(locationId: string): Promise<void> {
    const result = await this.hasuraSystem.executeQuery<{
      business_location_transfer_requests_aggregate: {
        aggregate: { count: number };
      };
    }>(
      `
      query PendingForLocation($locationId: uuid!) {
        business_location_transfer_requests_aggregate(
          where: { business_location_id: { _eq: $locationId }, status: { _eq: pending } }
        ) { aggregate { count } }
      }
    `,
      { locationId }
    );
    if (
      (result.business_location_transfer_requests_aggregate?.aggregate
        ?.count || 0) > 0
    ) {
      throw new HttpException(
        {
          success: false,
          error: 'A pending transfer already exists for this location',
          code: 'PENDING_TRANSFER_EXISTS',
        },
        HttpStatus.CONFLICT
      );
    }
  }

  private async expireStaleRequests(): Promise<void> {
    try {
      await this.hasuraSystem.executeMutation(
        `
        mutation ExpireTransfers($now: timestamptz!) {
          update_business_location_transfer_requests(
            where: { status: { _eq: pending }, expires_at: { _lt: $now } }
            _set: { status: expired, responded_at: $now }
          ) { affected_rows }
        }
      `,
        { now: new Date().toISOString() }
      );
    } catch (error: any) {
      this.logger.warn(`Failed to expire transfers: ${error?.message}`);
    }
  }

  private transferDeepLink(requestId: string): string {
    return `/business/locations?transferRequestId=${encodeURIComponent(requestId)}`;
  }

  private async notifyDestination(
    request: TransferRequestRow,
    locationName: string,
    fromBusinessName: string
  ): Promise<void> {
    const isMerge = request.transfer_mode === 'inventory_merge';
    const title = isMerge
      ? 'Inventory transfer request'
      : 'Location transfer request';
    const body = isMerge
      ? `${fromBusinessName} wants to move inventory from "${locationName}" into your business`
      : `${fromBusinessName} wants to transfer "${locationName}" to your business`;
    try {
      await this.notifications.sendBusinessLocationTransferPush({
        userId: request.to_user_id,
        title,
        body,
        data: {
          type: 'business_location_transfer',
          requestId: request.id,
          expiresAt: request.expires_at,
          mode: request.transfer_mode || 'location_ownership',
          url: this.transferDeepLink(request.id),
        },
      });
    } catch (error: any) {
      this.logger.warn(`Transfer push failed: ${error?.message}`);
    }
  }

  private async notifyDestinationOfCancel(
    request: TransferRequestRow,
    locationName: string
  ): Promise<void> {
    const isMerge = request.transfer_mode === 'inventory_merge';
    const noun = isMerge ? 'Inventory' : 'Location';
    try {
      await this.notifications.sendBusinessLocationTransferPush({
        userId: request.to_user_id,
        title: `${noun} transfer cancelled`,
        body: `A ${noun.toLowerCase()} transfer request for "${locationName || 'location'}" was cancelled`,
        data: {
          type: 'business_location_transfer_result',
          requestId: request.id,
          outcome: 'cancelled',
          mode: request.transfer_mode || 'location_ownership',
          url: this.transferDeepLink(request.id),
        },
      });
    } catch (error: any) {
      this.logger.warn(`Transfer cancel push failed: ${error?.message}`);
    }
  }

  private async notifyRequester(
    request: TransferRequestRow,
    outcome: 'accepted' | 'rejected',
    locationName: string
  ): Promise<void> {
    const isMerge = request.transfer_mode === 'inventory_merge';
    const noun = isMerge ? 'Inventory' : 'Location';
    const title =
      outcome === 'accepted'
        ? `${noun} transfer accepted`
        : `${noun} transfer rejected`;
    const body =
      outcome === 'accepted'
        ? `Your transfer of "${locationName || 'location'}" was accepted`
        : `Your ${noun.toLowerCase()} transfer request was rejected`;
    try {
      await this.notifications.sendBusinessLocationTransferPush({
        userId: request.requested_by_user_id,
        title,
        body,
        data: {
          type: 'business_location_transfer_result',
          requestId: request.id,
          outcome,
          mode: request.transfer_mode || 'location_ownership',
          url: this.transferDeepLink(request.id),
        },
      });
    } catch (error: any) {
      this.logger.warn(`Transfer result push failed: ${error?.message}`);
    }
  }

  private requestSelection(): string {
    return `
      id business_location_id from_business_id to_business_id
      to_business_location_id transfer_mode
      from_user_id to_user_id requested_by_user_id status
      item_count rental_item_count order_count metadata
      expires_at responded_at created_at updated_at
      business_location { id name }
      to_business_location { id name }
      from_business { id name user { email } }
      to_business { id name user { email } }
      requested_by_user { id email first_name last_name }
    `;
  }

  private buildAdminWhere(
    status?: string,
    search?: string
  ): Record<string, unknown> {
    const parts: Record<string, unknown>[] = [];
    if (status) parts.push({ status: { _eq: status } });
    if (search?.trim()) {
      const pattern = `%${search.trim()}%`;
      parts.push({
        _or: [
          { from_business: { name: { _ilike: pattern } } },
          { to_business: { name: { _ilike: pattern } } },
          { business_location: { name: { _ilike: pattern } } },
          { to_business_location: { name: { _ilike: pattern } } },
        ],
      });
    }
    if (!parts.length) return {};
    if (parts.length === 1) return parts[0];
    return { _and: parts };
  }

  private toBusinessOption(b: {
    id: string;
    name: string;
    user: { email: string };
  }): TransferBusinessOption {
    return { id: b.id, name: b.name, email: b.user?.email || '' };
  }

  private assertLocationBelongsTo(
    location: LocationContext,
    businessId: string
  ): void {
    if (location.business_id !== businessId) {
      throw new HttpException(
        { success: false, error: 'Location does not belong to this business' },
        HttpStatus.FORBIDDEN
      );
    }
  }

  private assertCanTransfer(preview: TransferPreview): void {
    if (preview.canTransfer) return;
    throw new HttpException(
      {
        success: false,
        error: 'Transfer is blocked',
        code: 'TRANSFER_BLOCKED',
        blockReasons: preview.blockReasons,
      },
      HttpStatus.CONFLICT
    );
  }

  private assertNoBlockReasons(blockReasons: string[]): void {
    if (!blockReasons.length) return;
    throw new HttpException(
      {
        success: false,
        error: 'Transfer is blocked',
        code: 'TRANSFER_BLOCKED',
        blockReasons,
      },
      HttpStatus.CONFLICT
    );
  }

  private assertNameMatches(input: string, expected: string): void {
    if (input.trim().toLowerCase() !== expected.trim().toLowerCase()) {
      throw new HttpException(
        {
          success: false,
          error: 'Confirmation name does not match destination business',
          code: 'NAME_MISMATCH',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private assertPendingActive(request: TransferRequestRow): void {
    if (request.status !== 'pending') {
      throw new HttpException(
        { success: false, error: 'Transfer request is not pending' },
        HttpStatus.CONFLICT
      );
    }
    if (new Date(request.expires_at).getTime() < Date.now()) {
      throw new HttpException(
        {
          success: false,
          error: 'Transfer request has expired',
          code: 'EXPIRED',
        },
        HttpStatus.CONFLICT
      );
    }
  }
}
