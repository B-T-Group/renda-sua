import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateProductInterestDto } from './dto/create-product-interest.dto';

const DUPLICATE_WINDOW_HOURS = 24;

const GET_INVENTORY_FOR_INTEREST = `
  query GetInventoryForInterest($id: uuid!) {
    business_inventory_by_pk(id: $id) {
      id
      is_active
      business_location_id
      item_id
      business_location {
        id
        name
        business_id
        business {
          id
          name
          user_id
        }
      }
      item {
        id
        name
        interest_only
        moderation_status
        is_active
      }
    }
  }
`;

const RECENT_INTEREST = `
  query RecentProductInterest(
    $userId: uuid!
    $inventoryId: uuid!
    $since: timestamptz!
  ) {
    product_interest_requests(
      where: {
        client_user_id: { _eq: $userId }
        business_inventory_id: { _eq: $inventoryId }
        created_at: { _gte: $since }
      }
      limit: 1
    ) {
      id
    }
  }
`;

const INSERT_INTEREST = `
  mutation InsertProductInterest($object: product_interest_requests_insert_input!) {
    insert_product_interest_requests_one(object: $object) {
      id
      created_at
      status
    }
  }
`;

const LIST_CLIENT = `
  query ListClientProductInterest($userId: uuid!, $limit: Int!, $offset: Int!) {
    product_interest_requests_aggregate(
      where: { client_user_id: { _eq: $userId } }
    ) {
      aggregate { count }
    }
    product_interest_requests(
      where: { client_user_id: { _eq: $userId } }
      order_by: { created_at: desc }
      limit: $limit
      offset: $offset
    ) {
      id
      client_note
      status
      created_at
      business_inventory_id
      business_location_id
      item { id name }
      business_location { id name }
      business { id name }
    }
  }
`;

const LIST_BUSINESS = `
  query ListBusinessProductInterest(
    $businessId: uuid!
    $where: product_interest_requests_bool_exp!
    $limit: Int!
    $offset: Int!
  ) {
    product_interest_requests_aggregate(where: $where) {
      aggregate { count }
    }
    product_interest_requests(
      where: $where
      order_by: { created_at: desc }
      limit: $limit
      offset: $offset
    ) {
      id
      client_note
      status
      created_at
      business_inventory_id
      business_location_id
      item { id name }
      business_location { id name }
      client_user {
        id
        first_name
        last_name
        email
        phone_number
      }
    }
  }
`;

type InventoryForInterest = {
  id: string;
  is_active: boolean;
  business_location_id: string;
  item_id: string;
  business_location: {
    id: string;
    name: string | null;
    business_id: string;
    business: {
      id: string;
      name: string | null;
      user_id: string;
    } | null;
  } | null;
  item: {
    id: string;
    name: string;
    interest_only: boolean;
    moderation_status: string;
    is_active: boolean;
  } | null;
};

@Injectable()
export class ProductInterestService {
  private readonly logger = new Logger(ProductInterestService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly notificationsService: NotificationsService
  ) {}

  async createInterest(dto: CreateProductInterestDto) {
    const user = await this.hasuraUserService.getUser();
    this.assertClient(user);
    const inventory = await this.fetchInventory(dto.businessInventoryId);
    this.assertInterestEligible(inventory);
    await this.assertNotDuplicate(user.id, inventory.id);
    const note = dto.note?.trim() || null;
    const created = await this.insertInterest(user.id, inventory, note);
    await this.notifyBusiness(user, inventory, created.id, note);
    return created;
  }

  async listForClient(page = 1, limit = 20) {
    const user = await this.hasuraUserService.getUser();
    this.assertClient(user);
    const safe = this.paginate(page, limit);
    const res = await this.hasuraSystemService.executeQuery<{
      product_interest_requests_aggregate: { aggregate: { count: number } };
      product_interest_requests: unknown[];
    }>(LIST_CLIENT, {
      userId: user.id,
      limit: safe.limit,
      offset: safe.offset,
    });
    return this.pageResult(
      res.product_interest_requests ?? [],
      res.product_interest_requests_aggregate?.aggregate?.count ?? 0,
      safe
    );
  }

  async listForBusiness(page = 1, limit = 20, locationId?: string) {
    const user = await this.hasuraUserService.getUser();
    const businessId = user.business?.id;
    if (!businessId) {
      throw new HttpException(
        'Only businesses can list interest leads',
        HttpStatus.FORBIDDEN
      );
    }
    const safe = this.paginate(page, limit);
    const where: Record<string, unknown> = {
      business_id: { _eq: businessId },
    };
    if (locationId) {
      where.business_location_id = { _eq: locationId };
    }
    const res = await this.hasuraSystemService.executeQuery<{
      product_interest_requests_aggregate: { aggregate: { count: number } };
      product_interest_requests: unknown[];
    }>(LIST_BUSINESS, {
      businessId,
      where,
      limit: safe.limit,
      offset: safe.offset,
    });
    return this.pageResult(
      res.product_interest_requests ?? [],
      res.product_interest_requests_aggregate?.aggregate?.count ?? 0,
      safe
    );
  }

  private assertClient(user: { client?: { id?: string } | null }) {
    if (!user.client?.id) {
      throw new HttpException(
        'Only clients can submit interest',
        HttpStatus.FORBIDDEN
      );
    }
  }

  private async fetchInventory(id: string): Promise<InventoryForInterest> {
    const res = await this.hasuraSystemService.executeQuery<{
      business_inventory_by_pk: InventoryForInterest | null;
    }>(GET_INVENTORY_FOR_INTEREST, { id });
    const inventory = res.business_inventory_by_pk;
    if (!inventory) {
      throw new HttpException('Listing not found', HttpStatus.NOT_FOUND);
    }
    return inventory;
  }

  private assertInterestEligible(inventory: InventoryForInterest) {
    const item = inventory.item;
    if (!inventory.is_active || !item?.is_active) {
      throw new HttpException('Listing is unavailable', HttpStatus.BAD_REQUEST);
    }
    if (item.moderation_status !== 'approved') {
      throw new HttpException('Listing is unavailable', HttpStatus.BAD_REQUEST);
    }
    if (!item.interest_only) {
      throw new HttpException(
        {
          success: false,
          error: 'NOT_INTEREST_ONLY',
          message: 'This listing is not configured for interest requests',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    if (!inventory.business_location?.business_id) {
      throw new HttpException('Listing is unavailable', HttpStatus.BAD_REQUEST);
    }
  }

  private async assertNotDuplicate(userId: string, inventoryId: string) {
    const since = new Date(
      Date.now() - DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();
    const res = await this.hasuraSystemService.executeQuery<{
      product_interest_requests: Array<{ id: string }>;
    }>(RECENT_INTEREST, { userId, inventoryId, since });
    if ((res.product_interest_requests ?? []).length > 0) {
      throw new HttpException(
        {
          success: false,
          error: 'DUPLICATE_INTEREST',
          message:
            'You already submitted interest for this item recently. The business will follow up.',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async insertInterest(
    userId: string,
    inventory: InventoryForInterest,
    note: string | null
  ) {
    const location = inventory.business_location!;
    const res = await this.hasuraSystemService.executeMutation<{
      insert_product_interest_requests_one: {
        id: string;
        created_at: string;
        status: string;
      };
    }>(INSERT_INTEREST, {
      object: {
        client_user_id: userId,
        item_id: inventory.item_id,
        business_inventory_id: inventory.id,
        business_id: location.business_id,
        business_location_id: location.id,
        client_note: note,
        status: 'submitted',
      },
    });
    return res.insert_product_interest_requests_one;
  }

  private async notifyBusiness(
    user: {
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      phone_number?: string | null;
    },
    inventory: InventoryForInterest,
    requestId: string,
    note: string | null
  ) {
    const businessUserId = inventory.business_location?.business?.user_id;
    if (!businessUserId) return;
    const clientName =
      [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
      'A client';
    try {
      await this.notificationsService.sendBusinessProductInterestNotification({
        businessUserId,
        requestId,
        itemName: inventory.item?.name ?? 'Product',
        locationName: inventory.business_location?.name?.trim() || '—',
        clientName,
        clientEmail: user.email ?? null,
        clientPhone: user.phone_number ?? null,
        clientNote: note,
        inventoryId: inventory.id,
      });
    } catch (error: any) {
      this.logger.error(
        `notifyBusiness interest ${requestId}: ${error?.message ?? error}`
      );
    }
  }

  private paginate(page: number, limit: number) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Math.min(
      50,
      Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 20)
    );
    return {
      page: safePage,
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
    };
  }

  private pageResult(
    items: unknown[],
    total: number,
    safe: { page: number; limit: number }
  ) {
    return {
      items,
      total,
      page: safe.page,
      limit: safe.limit,
      totalPages: Math.max(1, Math.ceil(total / safe.limit)),
    };
  }
}
