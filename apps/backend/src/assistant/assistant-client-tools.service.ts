import type { Tool } from '@aws-sdk/client-bedrock-runtime';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { firstImage, formatPrice } from './assistant-cards';
import type {
  AssistantCard,
  AssistantIdentity,
  AssistantLocale,
  AssistantToolResult,
} from './assistant.types';

const CLIENT_TOOLS = new Set([
  'get_my_recent_orders',
  'get_order_status',
  'get_reorder_options',
  'get_my_rental_bookings',
]);

const PUBLIC_TOOLS = new Set(['search_rentals', 'search_restaurants']);

const REORDER_STATUSES = new Set(['complete', 'delivered']);

type OrderRow = {
  id: string;
  order_number: string;
  current_status: string;
  total_amount: number;
  currency: string;
  created_at?: string;
  business?: { name?: string | null } | null;
  order_items?: Array<{
    item_name?: string | null;
    item?: { item_images?: Array<{ image_url?: string | null; display_url?: string | null }> } | null;
  }>;
};

export class AssistantClientToolsService {
  constructor(private readonly hasura: HasuraSystemService) {}

  handles(name: string): boolean {
    return CLIENT_TOOLS.has(name) || PUBLIC_TOOLS.has(name);
  }

  publicTools(): Tool[] {
    return [rentalSearchTool(), restaurantSearchTool()];
  }

  tools(identity: AssistantIdentity): Tool[] {
    if (identity.accountType !== 'client' || !identity.clientId) return [];
    return [
      simpleTool('get_my_recent_orders', 'Up to five of this client’s recent orders. Call for order history.'),
      orderStatusTool(),
      simpleTool('get_reorder_options', 'Completed orders this client can reorder.'),
      simpleTool('get_my_rental_bookings', 'This client’s recent rental bookings.'),
    ];
  }

  run(request: ToolCall): Promise<AssistantToolResult> {
    if (PUBLIC_TOOLS.has(request.name)) return this.searchPublic(request);
    if (!request.identity.clientId || request.identity.accountType !== 'client') {
      return Promise.resolve({
        content: 'No customer order profile is linked to this account, so orders cannot be looked up.',
      });
    }
    if (request.name === 'get_my_recent_orders') return this.recentOrders(request.identity.clientId);
    if (request.name === 'get_order_status') return this.orderStatus(request);
    if (request.name === 'get_reorder_options') return this.reorder(request);
    if (request.name === 'get_my_rental_bookings') return this.bookings(request.identity.clientId);
    return Promise.resolve({ content: `Unknown tool: ${request.name}`, handoff: true });
  }

  private async recentOrders(clientId: string): Promise<AssistantToolResult> {
    const orders = await this.loadOrders(RECENT_ORDERS_QUERY, { clientId });
    return { content: JSON.stringify(orders), cards: orders.map((order) => orderCard(order, true)) };
  }

  private async orderStatus(request: ToolCall): Promise<AssistantToolResult> {
    const orderNumber = String(request.input.order_number || '').trim();
    if (!orderNumber) return { content: 'An order number is required.' };
    const orders = await this.loadOrders(ORDER_STATUS_QUERY, {
      clientId: request.identity.clientId,
      orderNumber,
    });
    const order = orders[0];
    return {
      content: JSON.stringify(order || null),
      cards: order ? [orderCard(order, true)] : [],
    };
  }

  private async reorder(request: ToolCall): Promise<AssistantToolResult> {
    const orders = await this.loadOrders(REORDER_QUERY, { clientId: request.identity.clientId });
    if (!orders.length) {
      return {
        content: 'No recent completed orders found. The customer has not placed any orders yet.',
      };
    }
    return { content: reorderText(orders, request.locale), cards: orders.map((order) => orderCard(order, true)) };
  }

  private async bookings(clientId: string): Promise<AssistantToolResult> {
    const result = await this.hasura.executeQuery<{ rental_bookings: BookingRow[] }>(
      BOOKINGS_QUERY,
      { clientId }
    );
    const rows = result.rental_bookings || [];
    return { content: JSON.stringify(rows.map(bookingSummary)), cards: rows.map(bookingCard) };
  }

  private async searchPublic(request: ToolCall): Promise<AssistantToolResult> {
    const query = String(request.input.query || '').trim();
    const country = request.identity.market?.country_code;
    if (!country) return { content: 'Market information is required to search.' };
    if (query.length < 2) return { content: 'Please provide a search query with at least 2 characters.' };
    if (request.name === 'search_rentals') return this.searchRentals(country, query);
    return this.searchRestaurants(country, query);
  }

  private async searchRentals(country: string, query: string): Promise<AssistantToolResult> {
    const result = await this.hasura.executeQuery<{ rental_location_listings: RentalRow[] }>(
      RENTAL_SEARCH_QUERY,
      { country, q: `%${query}%` }
    );
    const rows = result.rental_location_listings || [];
    if (!rows.length) return { content: `No rentals found for "${query}" in ${country}.` };
    return { content: rentalText(rows), cards: rows.map(rentalCard) };
  }

  private async searchRestaurants(country: string, query: string): Promise<AssistantToolResult> {
    const result = await this.hasura.executeQuery<{ business_locations: RestaurantRow[] }>(
      RESTAURANT_QUERY,
      { country, q: `%${query}%` }
    );
    const rows = dedupeRestaurants(result.business_locations || []);
    if (!rows.length) return { content: `No restaurants found for "${query}" in ${country}.` };
    return { content: restaurantText(rows), cards: rows.map(restaurantCard) };
  }

  private async loadOrders(query: string, variables: Record<string, unknown>): Promise<OrderRow[]> {
    const result = await this.hasura.executeQuery<{ orders: OrderRow[] }>(query, variables);
    return result.orders || [];
  }
}

type ToolCall = {
  name: string;
  input: Record<string, unknown>;
  identity: AssistantIdentity;
  locale?: AssistantLocale;
};

function orderCard(order: OrderRow, allowReorder: boolean): AssistantCard {
  const image = order.order_items?.[0]?.item?.item_images;
  const card: AssistantCard = {
    kind: 'order',
    id: order.id,
    title: order.business?.name || order.order_items?.[0]?.item_name || order.order_number,
    imageUrl: firstImage(image),
    priceLabel: formatPrice(order.total_amount, order.currency),
    href: `/orders/${order.id}`,
  };
  if (allowReorder && REORDER_STATUSES.has(order.current_status)) {
    card.secondaryHref = `/orders/${order.id}/reorder`;
  }
  return card;
}

function reorderText(orders: OrderRow[], locale?: AssistantLocale): string {
  const lines = ['**Recent orders you can reorder:**\n'];
  for (const order of orders.slice(0, 5)) {
    const date = new Date(order.created_at || '').toLocaleDateString(
      locale === 'fr' ? 'fr-FR' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric' }
    );
    const amount = `${order.total_amount} ${order.currency}`;
    lines.push(`- **${order.business?.name || 'Store'}** (${date}) - ${amount} [Reorder](/orders/${order.id}/reorder)`);
  }
  lines.push('\nTap "Reorder" to add these items to your cart at current prices.');
  return lines.join('\n');
}

type BookingRow = {
  id: string;
  booking_number?: string | null;
  status: string;
  total_amount?: number | null;
  currency?: string | null;
  rental_location_listing?: {
    id: string;
    rental_item?: {
      name?: string | null;
      rental_item_images?: Array<{ image_url?: string | null; display_url?: string | null }>;
    } | null;
  } | null;
};

function bookingSummary(row: BookingRow) {
  return {
    id: row.id,
    number: row.booking_number || null,
    status: row.status,
    title: row.rental_location_listing?.rental_item?.name || null,
    total: formatPrice(row.total_amount, row.currency),
  };
}

function bookingCard(row: BookingRow): AssistantCard {
  const item = row.rental_location_listing?.rental_item;
  return {
    kind: 'rental',
    id: row.id,
    title: item?.name || row.booking_number || 'Rental booking',
    imageUrl: firstImage(item?.rental_item_images),
    priceLabel: formatPrice(row.total_amount, row.currency) || row.status,
    href: `/rentals/bookings/${row.id}`,
  };
}

type RentalRow = {
  id: string;
  base_price_per_hour?: number | null;
  base_price_per_day?: number | null;
  rental_item?: {
    name?: string | null;
    currency?: string | null;
    rental_item_images?: Array<{ image_url?: string | null; display_url?: string | null }>;
  } | null;
};

function rentalCard(row: RentalRow): AssistantCard {
  const item = row.rental_item;
  const price = row.base_price_per_day ?? row.base_price_per_hour;
  const suffix = row.base_price_per_day != null ? '/day' : '/hour';
  const label = formatPrice(price, item?.currency);
  return {
    kind: 'rental',
    id: row.id,
    title: item?.name || 'Rental',
    imageUrl: firstImage(item?.rental_item_images),
    priceLabel: label ? `${label}${suffix}` : '',
    href: `/rentals/${row.id}`,
  };
}

function rentalText(rows: RentalRow[]): string {
  return rows.map((row) => `- ${rentalCard(row).title} ${rentalCard(row).priceLabel}`).join('\n');
}

type RestaurantRow = {
  id: string;
  name?: string | null;
  logo_url?: string | null;
  business?: { id: string; name?: string | null } | null;
};

function dedupeRestaurants(rows: RestaurantRow[]): RestaurantRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = row.business?.id || row.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, 6);
}

function restaurantCard(row: RestaurantRow): AssistantCard {
  const businessId = row.business?.id || row.id;
  return {
    kind: 'store',
    id: businessId,
    title: row.business?.name || row.name || 'Restaurant',
    imageUrl: row.logo_url || null,
    priceLabel: '',
    href: `/store/${businessId}?menu=food`,
  };
}

function restaurantText(rows: RestaurantRow[]): string {
  return rows.map((row) => `- ${restaurantCard(row).title}`).join('\n');
}

function simpleTool(name: string, description: string): Tool {
  return {
    toolSpec: { name, description, inputSchema: { json: { type: 'object', properties: {} } } },
  };
}

function rentalSearchTool(): Tool {
  return {
    toolSpec: {
      name: 'search_rentals',
      description: 'Search public rental listings in the customer market. Works for guests.',
      inputSchema: {
        json: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    },
  };
}

function restaurantSearchTool(): Tool {
  return {
    toolSpec: {
      name: 'search_restaurants',
      description: 'Search restaurants with a cooked-food menu in the customer market. Works for guests.',
      inputSchema: {
        json: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    },
  };
}

function orderStatusTool(): Tool {
  return {
    toolSpec: {
      name: 'get_order_status',
      description: 'Look up one of this client’s orders by order number.',
      inputSchema: {
        json: {
          type: 'object',
          properties: { order_number: { type: 'string' } },
          required: ['order_number'],
        },
      },
    },
  };
}

const ORDER_FIELDS = `
  id order_number current_status total_amount currency created_at
  business { name }
  order_items(limit: 1) {
    item_name
    item { item_images(limit: 1, order_by: { display_order: asc }) { image_url display_url } }
  }
`;

const RECENT_ORDERS_QUERY = `query AssistantRecentOrders($clientId: uuid!) {
  orders(
    where: { client_id: { _eq: $clientId } }
    order_by: { created_at: desc }
    limit: 5
  ) { ${ORDER_FIELDS} }
}`;

const ORDER_STATUS_QUERY = `query AssistantOrderStatus($clientId: uuid!, $orderNumber: String!) {
  orders(where: {
    client_id: { _eq: $clientId }
    order_number: { _eq: $orderNumber }
  }, limit: 1) { ${ORDER_FIELDS} }
}`;

const REORDER_QUERY = `query AssistantReorderOptions($clientId: uuid!) {
  orders(
    where: {
      client_id: { _eq: $clientId }
      current_status: { _in: ["complete", "delivered"] }
    }
    order_by: { created_at: desc }
    limit: 5
  ) { ${ORDER_FIELDS} }
}`;

const BOOKINGS_QUERY = `query AssistantClientBookings($clientId: uuid!) {
  rental_bookings(
    where: { client_id: { _eq: $clientId } }
    order_by: { created_at: desc }
    limit: 5
  ) {
    id booking_number status total_amount currency
    rental_location_listing {
      id
      rental_item {
        name
        rental_item_images(limit: 1, order_by: { display_order: asc }) { image_url display_url }
      }
    }
  }
}`;

const RENTAL_SEARCH_QUERY = `query AssistantRentalSearch($country: String!, $q: String!) {
  rental_location_listings(
    where: {
      is_active: { _eq: true }
      deleted_at: { _is_null: true }
      moderation_status: { _eq: approved }
      business_location: { is_active: { _eq: true }, address: { country: { _eq: $country } } }
      rental_item: {
        deleted_at: { _is_null: true }
        name: { _ilike: $q }
        business: { is_storefront_visible: { _eq: true } }
      }
    }
    limit: 6
    order_by: { updated_at: desc }
  ) {
    id base_price_per_hour base_price_per_day
    rental_item {
      name currency
      rental_item_images(limit: 1, order_by: { display_order: asc }) { image_url display_url }
    }
  }
}`;

const RESTAURANT_QUERY = `query AssistantRestaurants($country: String!, $q: String!) {
  business_locations(
    where: {
      is_active: { _eq: true }
      address: { country: { _eq: $country } }
      business_inventory: {
        item: { is_cooked_food: { _eq: true }, name: { _ilike: $q } }
      }
    }
    limit: 12
  ) {
    id name logo_url
    business { id name }
  }
}`;
