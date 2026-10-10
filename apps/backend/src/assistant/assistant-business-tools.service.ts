import type { Tool } from '@aws-sdk/client-bedrock-runtime';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { firstImage, formatPrice } from './assistant-cards';
import type {
  AssistantCard,
  AssistantIdentity,
  AssistantToolResult,
} from './assistant.types';

const BUSINESS_TOOLS = new Set([
  'get_my_business_summary',
  'get_my_business_orders',
  'get_my_catalog_summary',
  'get_my_rental_requests',
]);

type InventoryRow = {
  id: string;
  selling_price: number;
  computed_available_quantity?: number | null;
  item?: {
    name?: string | null;
    currency?: string | null;
    item_images?: Array<{ image_url?: string | null; display_url?: string | null }>;
  } | null;
};

export class AssistantBusinessToolsService {
  constructor(private readonly hasura: HasuraSystemService) {}

  handles(name: string): boolean {
    return BUSINESS_TOOLS.has(name);
  }

  tools(identity: AssistantIdentity): Tool[] {
    if (identity.accountType !== 'business' || !identity.businessId) return [];
    return [
      simpleTool('get_my_business_summary', 'Business name, locations, whether it can take orders, plan, and reel count.'),
      simpleTool('get_my_business_orders', 'Recent orders for this business. No customer phone numbers.'),
      simpleTool('get_my_catalog_summary', 'A few low-stock catalog items for this business.'),
      simpleTool('get_my_rental_requests', 'Pending rental requests for this business.'),
    ];
  }

  run(name: string, identity: AssistantIdentity): Promise<AssistantToolResult> {
    if (identity.accountType !== 'business' || !identity.businessId) {
      return Promise.resolve({ content: 'No business profile is linked to this account.' });
    }
    const businessId = identity.businessId;
    if (name === 'get_my_business_summary') return this.summary(businessId);
    if (name === 'get_my_business_orders') return this.orders(businessId);
    if (name === 'get_my_catalog_summary') return this.catalog(businessId);
    if (name === 'get_my_rental_requests') return this.rentalRequests(businessId);
    return Promise.resolve({ content: `Unknown tool: ${name}`, handoff: true });
  }

  private async summary(businessId: string): Promise<AssistantToolResult> {
    const result = await this.hasura.executeQuery<{
      businesses_by_pk: BusinessRow | null;
      reels_aggregate?: { aggregate: { count: number } | null };
    }>(SUMMARY_QUERY, { businessId });
    const business = result.businesses_by_pk;
    if (!business) return { content: 'Business profile was not found.' };
    return {
      content: JSON.stringify({
        name: business.name,
        canAcceptOrders: business.can_accept_orders === true,
        plan: business.account_type,
        verified: business.is_verified === true,
        locations: (business.business_locations || []).map((row) => row.name),
        reelCount: result.reels_aggregate?.aggregate?.count ?? 0,
      }),
    };
  }

  private async orders(businessId: string): Promise<AssistantToolResult> {
    const result = await this.hasura.executeQuery<{ orders: BusinessOrderRow[] }>(
      ORDERS_QUERY,
      { businessId }
    );
    const orders = result.orders || [];
    return { content: JSON.stringify(orders.map(orderSummary)), cards: orders.map(orderCard) };
  }

  private async catalog(businessId: string): Promise<AssistantToolResult> {
    const result = await this.hasura.executeQuery<{ business_inventory: InventoryRow[] }>(
      CATALOG_QUERY,
      { businessId }
    );
    const rows = result.business_inventory || [];
    const note = rows.length
      ? 'Low-stock items (1 to 5 available).'
      : 'No low-stock items were found.';
    return { content: `${note}\n${JSON.stringify(rows.map(itemSummary))}`, cards: rows.map(itemCard) };
  }

  private async rentalRequests(businessId: string): Promise<AssistantToolResult> {
    const result = await this.hasura.executeQuery<{ rental_requests: RequestRow[] }>(
      REQUESTS_QUERY,
      { businessId }
    );
    const rows = result.rental_requests || [];
    const note = rows.length ? 'Pending rental requests.' : 'No pending rental requests.';
    return { content: `${note}\n${JSON.stringify(rows.map(requestSummary))}`, cards: rows.map(requestCard) };
  }
}

type BusinessRow = {
  name: string;
  can_accept_orders?: boolean | null;
  account_type?: string | null;
  is_verified?: boolean | null;
  business_locations?: Array<{ name?: string | null }>;
};

type BusinessOrderRow = {
  id: string;
  order_number: string;
  current_status: string;
  total_amount: number;
  currency: string;
  order_items?: Array<{
    item_name?: string | null;
    item?: { item_images?: Array<{ image_url?: string | null; display_url?: string | null }> } | null;
  }>;
};

function orderSummary(order: BusinessOrderRow) {
  return {
    orderNumber: order.order_number,
    status: order.current_status,
    total: formatPrice(order.total_amount, order.currency),
    item: order.order_items?.[0]?.item_name || null,
  };
}

function orderCard(order: BusinessOrderRow): AssistantCard {
  return {
    kind: 'order',
    id: order.id,
    title: order.order_items?.[0]?.item_name || order.order_number,
    imageUrl: firstImage(order.order_items?.[0]?.item?.item_images),
    priceLabel: formatPrice(order.total_amount, order.currency),
    href: `/orders/${order.id}`,
  };
}

function itemSummary(row: InventoryRow) {
  return {
    name: row.item?.name || null,
    price: formatPrice(row.selling_price, row.item?.currency),
    available: row.computed_available_quantity ?? null,
  };
}

function itemCard(row: InventoryRow): AssistantCard {
  return {
    kind: 'item',
    id: row.id,
    title: row.item?.name || 'Item',
    imageUrl: firstImage(row.item?.item_images),
    priceLabel: formatPrice(row.selling_price, row.item?.currency),
    href: `/items/${row.id}`,
  };
}

type RequestRow = {
  id: string;
  status: string;
  rental_location_listing?: {
    rental_item?: {
      name?: string | null;
      rental_item_images?: Array<{ image_url?: string | null; display_url?: string | null }>;
    } | null;
  } | null;
};

function requestSummary(row: RequestRow) {
  return { status: row.status, item: row.rental_location_listing?.rental_item?.name || null };
}

function requestCard(row: RequestRow): AssistantCard {
  const item = row.rental_location_listing?.rental_item;
  return {
    kind: 'rental',
    id: row.id,
    title: item?.name || 'Rental request',
    imageUrl: firstImage(item?.rental_item_images),
    priceLabel: row.status,
    href: '/business/rentals',
  };
}

function simpleTool(name: string, description: string): Tool {
  return {
    toolSpec: { name, description, inputSchema: { json: { type: 'object', properties: {} } } },
  };
}

const SUMMARY_QUERY = `query AssistantBusiness($businessId: uuid!) {
  businesses_by_pk(id: $businessId) {
    name can_accept_orders account_type is_verified
    business_locations(limit: 8) { name }
  }
  reels_aggregate(where: { business_id: { _eq: $businessId } }) {
    aggregate { count }
  }
}`;

const ORDERS_QUERY = `query AssistantBusinessOrders($businessId: uuid!) {
  orders(
    where: { business_id: { _eq: $businessId } }
    order_by: { created_at: desc }
    limit: 5
  ) {
    id order_number current_status total_amount currency
    order_items(limit: 1) {
      item_name
      item { item_images(limit: 1, order_by: { display_order: asc }) { image_url display_url } }
    }
  }
}`;

const CATALOG_QUERY = `query AssistantBusinessCatalog($businessId: uuid!) {
  business_inventory(
    where: {
      business_location: { business_id: { _eq: $businessId } }
      computed_available_quantity: { _gt: 0, _lte: 5 }
    }
    limit: 5
  ) {
    id selling_price computed_available_quantity
    item {
      name currency
      item_images(limit: 1, order_by: { display_order: asc }) { image_url display_url }
    }
  }
}`;

const REQUESTS_QUERY = `query AssistantRentalRequests($businessId: uuid!) {
  rental_requests(
    where: {
      status: { _eq: pending }
      rental_location_listing: { rental_item: { business_id: { _eq: $businessId } } }
    }
    order_by: { created_at: desc }
    limit: 5
  ) {
    id status
    rental_location_listing {
      rental_item {
        name
        rental_item_images(limit: 1, order_by: { display_order: asc }) { image_url display_url }
      }
    }
  }
}`;
