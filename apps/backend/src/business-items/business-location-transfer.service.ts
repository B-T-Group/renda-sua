import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';

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

export type TransferRequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export interface TransferBusinessOption {
  id: string;
  name: string;
  email: string;
}

export interface TransferPreview {
  locationId: string;
  locationName: string;
  fromBusiness: TransferBusinessOption;
  toBusiness: TransferBusinessOption;
  itemCount: number;
  rentalItemCount: number;
  orderCount: number;
  completedOrderCount: number;
  canTransfer: boolean;
  blockReasons: string[];
}

export interface TransferRequestRow {
  id: string;
  business_location_id: string;
  from_business_id: string;
  to_business_id: string;
  from_user_id: string;
  to_user_id: string;
  requested_by_user_id: string;
  status: TransferRequestStatus;
  item_count: number;
  rental_item_count: number;
  order_count: number;
  metadata: Record<string, unknown>;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  business_location?: { id: string; name: string };
  from_business?: { id: string; name: string };
  to_business?: { id: string; name: string };
  requested_by_user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

interface LocationContext {
  id: string;
  name: string;
  business_id: string;
  address_id: string;
  is_primary: boolean;
  business: { id: string; name: string; user_id: string; user: { email: string } };
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

  async preview(
    locationId: string,
    toBusinessId: string,
    sourceBusinessId: string
  ): Promise<TransferPreview> {
    const location = await this.loadLocation(locationId);
    this.assertLocationBelongsTo(location, sourceBusinessId);
    const destination = await this.loadBusiness(toBusinessId);
    const ids = await this.loadTransferableIds(locationId);
    const blockReasons = await this.collectBlockReasons(
      location,
      destination,
      sourceBusinessId,
      ids
    );
    const orderCount = await this.countOrdersAtLocation(locationId);
    const completedOrderCount = await this.countCompletedOrders(locationId);
    return {
      locationId: location.id,
      locationName: location.name,
      fromBusiness: this.toBusinessOption(location.business),
      toBusiness: this.toBusinessOption(destination),
      itemCount: ids.itemIds.length,
      rentalItemCount: ids.rentalItemIds.length,
      orderCount,
      completedOrderCount,
      canTransfer: blockReasons.length === 0,
      blockReasons,
    };
  }

  async createRequest(params: {
    locationId: string;
    toBusinessId: string;
    confirmBusinessName: string;
    sourceBusinessId: string;
    requestedByUserId: string;
  }): Promise<TransferRequestRow> {
    await this.expireStaleRequests();
    const preview = await this.preview(
      params.locationId,
      params.toBusinessId,
      params.sourceBusinessId
    );
    this.assertCanTransfer(preview);
    this.assertNameMatches(params.confirmBusinessName, preview.toBusiness.name);
    await this.assertNoPendingRequest(params.locationId);
    const location = await this.loadLocation(params.locationId);
    const destination = await this.loadBusiness(params.toBusinessId);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TRANSFER_TTL_DAYS);
    const row = await this.insertRequest({
      location,
      destination,
      requestedByUserId: params.requestedByUserId,
      itemCount: preview.itemCount,
      rentalItemCount: preview.rentalItemCount,
      orderCount: preview.completedOrderCount,
      expiresAt: expiresAt.toISOString(),
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
  }): Promise<{ items: TransferRequestRow[]; total: number; page: number; limit: number }> {
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
        result.business_location_transfer_requests_aggregate?.aggregate?.count ||
        0,
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
    const preview = await this.preview(
      request.business_location_id,
      request.to_business_id,
      request.from_business_id
    );
    this.assertCanTransfer(preview);
    const location = await this.loadLocation(request.business_location_id);
    const ids = await this.loadTransferableIds(location.id);
    await this.executeAtomicTransfer(request, location, ids);
    const updated = await this.loadRequest(requestId);
    void this.notifyRequester(
      request,
      'accepted',
      location.name
    );
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
    return this.loadRequest(requestId);
  }

  private async executeAtomicTransfer(
    request: TransferRequestRow,
    location: LocationContext,
    ids: TransferableIds
  ): Promise<void> {
    const toBusinessId = request.to_business_id;
    const toUserId = request.to_user_id;
    const locationId = location.id;
    const addressId = location.address_id;
    const itemIds = ids.itemIds;
    const rentalItemIds = ids.rentalItemIds;
    const listingIds = ids.listingIds;
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
      locationId,
      toBusinessId,
      fromBusinessId: request.from_business_id,
      toUserId,
      addressId,
      itemIds,
      rentalItemIds,
      listingIds,
      now: new Date().toISOString(),
    });
    if (
      result.update_business_location_transfer_requests?.affected_rows !== 1
    ) {
      throw new HttpException(
        { success: false, error: 'Transfer request is no longer pending' },
        HttpStatus.CONFLICT
      );
    }
  }

  private async collectBlockReasons(
    location: LocationContext,
    destination: DestinationBusiness,
    sourceBusinessId: string,
    ids: TransferableIds
  ): Promise<string[]> {
    const reasons: string[] = [];
    if (destination.id === sourceBusinessId) {
      reasons.push('DESTINATION_SAME_AS_SOURCE');
    }
    if (location.is_primary) {
      reasons.push('PRIMARY_LOCATION');
    }
    const locationCount = await this.countLocations(sourceBusinessId);
    if (locationCount <= 1) {
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
    if (!itemIds.length) return false;
    const result = await this.hasuraSystem.executeQuery<{
      business_inventory_aggregate: { aggregate: { count: number } };
    }>(
      `
      query SharedItems($itemIds: [uuid!]!, $locationId: uuid!) {
        business_inventory_aggregate(
          where: {
            item_id: { _in: $itemIds }
            business_location_id: { _neq: $locationId }
          }
        ) { aggregate { count } }
      }
    `,
      { itemIds, locationId }
    );
    return (result.business_inventory_aggregate?.aggregate?.count || 0) > 0;
  }

  private async hasSharedRentals(
    locationId: string,
    rentalItemIds: string[]
  ): Promise<boolean> {
    if (!rentalItemIds.length) return false;
    const result = await this.hasuraSystem.executeQuery<{
      rental_location_listings_aggregate: { aggregate: { count: number } };
    }>(
      `
      query SharedRentals($rentalItemIds: [uuid!]!, $locationId: uuid!) {
        rental_location_listings_aggregate(
          where: {
            rental_item_id: { _in: $rentalItemIds }
            business_location_id: { _neq: $locationId }
          }
        ) { aggregate { count } }
      }
    `,
      { rentalItemIds, locationId }
    );
    return (
      (result.rental_location_listings_aggregate?.aggregate?.count || 0) > 0
    );
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
          id name business_id address_id is_primary
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

  private async notifyDestination(
    request: TransferRequestRow,
    locationName: string,
    fromBusinessName: string
  ): Promise<void> {
    try {
      await this.notifications.sendBusinessLocationTransferPush({
        userId: request.to_user_id,
        title: 'Location transfer request',
        body: `${fromBusinessName} wants to transfer "${locationName}" to your business`,
        data: {
          type: 'business_location_transfer',
          requestId: request.id,
          expiresAt: request.expires_at,
        },
      });
    } catch (error: any) {
      this.logger.warn(`Transfer push failed: ${error?.message}`);
    }
  }

  private async notifyRequester(
    request: TransferRequestRow,
    outcome: 'accepted' | 'rejected',
    locationName: string
  ): Promise<void> {
    const title =
      outcome === 'accepted'
        ? 'Location transfer accepted'
        : 'Location transfer rejected';
    const body =
      outcome === 'accepted'
        ? `Your transfer of "${locationName || 'location'}" was accepted`
        : 'Your location transfer request was rejected';
    try {
      await this.notifications.sendBusinessLocationTransferPush({
        userId: request.requested_by_user_id,
        title,
        body,
        data: {
          type: 'business_location_transfer_result',
          requestId: request.id,
          outcome,
        },
      });
    } catch (error: any) {
      this.logger.warn(`Transfer result push failed: ${error?.message}`);
    }
  }

  private requestSelection(): string {
    return `
      id business_location_id from_business_id to_business_id
      from_user_id to_user_id requested_by_user_id status
      item_count rental_item_count order_count metadata
      expires_at responded_at created_at updated_at
      business_location { id name }
      from_business { id name }
      to_business { id name }
      requested_by_user { id email first_name last_name }
    `;
  }

  private buildAdminWhere(status?: string, search?: string): Record<string, unknown> {
    const parts: Record<string, unknown>[] = [];
    if (status) parts.push({ status: { _eq: status } });
    if (search?.trim()) {
      const pattern = `%${search.trim()}%`;
      parts.push({
        _or: [
          { from_business: { name: { _ilike: pattern } } },
          { to_business: { name: { _ilike: pattern } } },
          { business_location: { name: { _ilike: pattern } } },
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
        { success: false, error: 'Transfer request has expired', code: 'EXPIRED' },
        HttpStatus.CONFLICT
      );
    }
  }
}
