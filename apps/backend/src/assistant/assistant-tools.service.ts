import { Injectable, Logger } from '@nestjs/common';
import type { Tool, ToolConfiguration } from '@aws-sdk/client-bedrock-runtime';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { InventoryItemsService } from '../inventory-items/inventory-items.service';
import { AppConfigService } from '../app-config/app-config.service';
import { AssistantMarketsCatalogService } from './assistant-markets-catalog.service';
import {
  getKnowledgeSection,
  KNOWLEDGE_TOPICS,
  type KnowledgeTopic,
} from './knowledge';
import type {
  AssistantIdentity,
  AssistantLocale,
} from './assistant.types';

export interface AssistantToolResult {
  content: string;
  handoff?: boolean;
}

interface ToolRequest {
  name: string;
  input: Record<string, unknown>;
  identity: AssistantIdentity;
  locale?: AssistantLocale;
}

/** Live config tools that satisfy market/payment grounding (not static KB copy). */
const MARKET_CATALOG_TOOLS = new Set([
  'list_supported_country_states',
  'list_supported_payment_systems',
]);

@Injectable()
export class AssistantToolsService {
  private readonly logger = new Logger(AssistantToolsService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly marketsCatalog: AssistantMarketsCatalogService,
    private readonly inventoryItems: InventoryItemsService,
    private readonly appConfig: AppConfigService
  ) {}

  async getToolConfig(identity: AssistantIdentity): Promise<ToolConfiguration> {
    const tools = [
      this.knowledgeTool(),
      this.countryStatesTool(),
      this.paymentSystemsTool(),
      this.humanSupportTool(),
    ];
    
    const country = identity.market?.country_code;
    const shoppingEnabled = await this.isShoppingEnabled(country);
    if (shoppingEnabled) {
      tools.push(this.searchCatalogTool());
    }
    
    if (identity.userId) tools.push(...this.userTools(identity));
    if (identity.clientId) tools.push(this.reorderOptionsTool());
    return { tools };
  }

  buildToolConfig(identity: AssistantIdentity): Promise<ToolConfiguration> {
    return this.getToolConfig(identity);
  }

  private async isShoppingEnabled(countryCode?: string): Promise<boolean> {
    try {
      const flags = await this.appConfig.getClientFlags(countryCode);
      return flags.assistant_shopping_v1 === true;
    } catch (error: any) {
      this.logger.warn(`Failed to check shopping flag: ${error.message}`);
      return false;
    }
  }

  isMarketCatalogTool(name: string): boolean {
    return MARKET_CATALOG_TOOLS.has(name);
  }

  async executeTool(
    name: string,
    input: Record<string, unknown>,
    identity: AssistantIdentity
  ): Promise<AssistantToolResult>;
  async executeTool(request: ToolRequest): Promise<AssistantToolResult>;
  async executeTool(
    nameOrRequest: string | ToolRequest,
    input: Record<string, unknown> = {},
    identity?: AssistantIdentity
  ): Promise<AssistantToolResult> {
    const request = this.normalizeRequest(nameOrRequest, input, identity);
    try {
      return await this.runTool(request);
    } catch (error: any) {
      this.logger.warn(`Assistant tool ${request.name} failed: ${error.message}`);
      return { content: 'The requested information is unavailable.', handoff: true };
    }
  }

  private normalizeRequest(
    nameOrRequest: string | ToolRequest,
    input: Record<string, unknown>,
    identity?: AssistantIdentity
  ): ToolRequest {
    if (typeof nameOrRequest !== 'string') return nameOrRequest;
    if (!identity) throw new Error('Assistant identity is required');
    return {
      name: nameOrRequest,
      input,
      identity,
      locale: identity.preferredLanguage || 'en',
    };
  }

  private async runTool(request: ToolRequest): Promise<AssistantToolResult> {
    if (request.name === 'get_knowledge') return this.getKnowledge(request);
    if (request.name === 'list_supported_country_states') {
      return this.listCountryStates(request);
    }
    if (request.name === 'list_supported_payment_systems') {
      return this.listPaymentSystems(request);
    }
    if (request.name === 'search_catalog') {
      return this.searchCatalog(request);
    }
    if (request.name === 'request_human_support') return this.handoff(request);
    if (!request.identity.userId) return { content: 'Authentication is required.' };
    if (
      request.name === 'get_my_recent_orders' ||
      request.name === 'get_order_status' ||
      request.name === 'get_reorder_options'
    ) {
      if (!request.identity.clientId) {
        return {
          content:
            'No customer order profile is linked to this account, so orders cannot be looked up.',
        };
      }
    }
    if (request.name === 'get_my_recent_orders') {
      return this.getOrders(request.identity.userId!);
    }
    if (request.name === 'get_order_status') return this.getOrder(request);
    if (request.name === 'get_reorder_options') return this.getReorderOptions(request);
    if (request.name === 'get_my_addresses') {
      return this.getAddresses(request.identity);
    }
    if (request.name === 'get_my_profile_summary') {
      return this.getProfile(request.identity);
    }
    return { content: `Unknown tool: ${request.name}`, handoff: true };
  }

  private async listCountryStates(
    request: ToolRequest
  ): Promise<AssistantToolResult> {
    const country = this.resolveOptionalCountry(request);
    return { content: await this.marketsCatalog.listCountryStates(country) };
  }

  private async listPaymentSystems(
    request: ToolRequest
  ): Promise<AssistantToolResult> {
    const country = this.resolveOptionalCountry(request);
    return { content: await this.marketsCatalog.listPaymentSystems(country) };
  }

  /** Only explicit tool input — omit to list all countries. */
  private resolveOptionalCountry(request: ToolRequest): string | null {
    if (typeof request.input.country_code === 'string') {
      return request.input.country_code;
    }
    if (typeof request.input.country === 'string') {
      return request.input.country;
    }
    return null;
  }

  private getKnowledge(request: ToolRequest): AssistantToolResult {
    const topic = String(request.input.topic || '') as KnowledgeTopic;
    if (!KNOWLEDGE_TOPICS.includes(topic)) {
      return { content: 'Unknown knowledge topic.', handoff: true };
    }
    return {
      content: getKnowledgeSection({
        topic,
        locale: request.locale === 'fr' ? 'fr' : 'en',
        country:
          (typeof request.input.country === 'string' && request.input.country) ||
          request.identity.country,
      }),
    };
  }

  private handoff(request: ToolRequest): AssistantToolResult {
    const technical = request.input.issue_type === 'technical';
    const guidance = technical
      ? 'Handoff recorded for the technical team. On WhatsApp reply with exactly [[NO_REPLY]]. In-app, tell the customer the technical team will investigate and get back shortly.'
      : 'Handoff recorded. On WhatsApp reply with exactly [[NO_REPLY]]. In-app, say we will get back shortly.';
    return { content: guidance, handoff: true };
  }

  private async getOrders(userId: string): Promise<AssistantToolResult> {
    const result = await this.hasura.executeQuery<{ orders: unknown[] }>(
      RECENT_ORDERS_QUERY,
      { userId }
    );
    return { content: JSON.stringify(result.orders || []) };
  }

  private async getOrder(request: ToolRequest): Promise<AssistantToolResult> {
    const orderNumber = String(
      request.input.order_number || request.input.orderReference || ''
    ).trim();
    if (!orderNumber) return { content: 'An order number is required.' };
    const result = await this.hasura.executeQuery<{ orders: unknown[] }>(
      ORDER_STATUS_QUERY,
      { userId: request.identity.userId, orderNumber }
    );
    return { content: JSON.stringify(result.orders?.[0] || null) };
  }

  private async getAddresses(
    identity: AssistantIdentity
  ): Promise<AssistantToolResult> {
    const type = identity.accountType;
    if (!identity.userId || !['client', 'agent', 'business'].includes(type || '')) {
      return { content: 'No address profile is available.' };
    }
    const addresses = await this.hasura.getAllUserAddresses(identity.userId, type!);
    return { content: JSON.stringify(addresses.slice(0, 10)) };
  }

  private async searchCatalog(
    request: ToolRequest
  ): Promise<AssistantToolResult> {
    const query = String(request.input.query || request.input.q || '').trim();
    if (!query || query.length < 2) {
      return {
        content: 'Please provide a search query with at least 2 characters.',
      };
    }

    const market = request.identity.market;
    if (!market?.country_code) {
      return {
        content: 'Market information is required to search the catalog.',
      };
    }

    try {
      const suggestions = await this.inventoryItems.getInventorySearchSuggestions({
        q: query,
        country_code: market.country_code,
        is_active: true,
        include_unavailable: false,
      });

      if (!suggestions.length) {
        return {
          content: `No products found for "${query}" in ${market.country_code}. Try a different search term.`,
        };
      }

      const products = suggestions
        .filter((s: { kind: string }) => s.kind === 'product')
        .slice(0, 8) as Array<{
          kind: 'product';
          inventoryId: string;
          title: string;
          price: number;
          currency: string;
          available?: boolean;
        }>;
      const categories = suggestions
        .filter((s: { kind: string }) => s.kind === 'category')
        .slice(0, 3) as Array<{ kind: 'category'; value: string }>;

      const formatted = [];
      
      if (products.length > 0) {
        formatted.push('**Products:**');
        for (const p of products) {
          // Emit relative path for in-app navigation
          const itemLink = `/items/${p.inventoryId}`;
          const price = p.price && p.currency ? ` - ${p.price} ${p.currency}` : '';
          const availability = p.available === false ? ' (currently unavailable)' : '';
          formatted.push(`- [${p.title}](${itemLink})${price}${availability}`);
        }
      }

      if (categories.length > 0) {
        formatted.push('\n**Categories:**');
        for (const c of categories) {
          // Emit relative path for in-app navigation
          const catLink = `/items?search=${encodeURIComponent(c.value)}`;
          formatted.push(`- [${c.value}](${catLink})`);
        }
      }

      const searchLink = `/items?search=${encodeURIComponent(query)}`;
      formatted.push(`\n[View all results for "${query}"](${searchLink})`);

      return { content: formatted.join('\n') };
    } catch (error: any) {
      this.logger.error(`Catalog search failed: ${error.message}`, error.stack);
      return {
        content: 'Unable to search the catalog at this time. Please try again.',
      };
    }
  }

  private getProfile(identity: AssistantIdentity): AssistantToolResult {
    return {
      content: JSON.stringify({
        firstName: identity.firstName,
        country: identity.country,
        accountType: identity.accountType,
        preferredLanguage: identity.preferredLanguage,
      }),
    };
  }

  private async getReorderOptions(
    request: ToolRequest
  ): Promise<AssistantToolResult> {
    const result = await this.hasura.executeQuery<{
      orders: Array<{
        id: string;
        order_number: string;
        current_status: string;
        total_amount: number;
        currency: string;
        created_at: string;
        business: { id: string; name: string };
      }>;
    }>(REORDER_OPTIONS_QUERY, { userId: request.identity.userId });

    const orders = result.orders || [];
    if (orders.length === 0) {
      return {
        content:
          'No recent completed orders found. The customer has not placed any orders yet.',
      };
    }

    const formatted = ['**Recent orders you can reorder:**\n'];

    for (const order of orders.slice(0, 5)) {
      const date = new Date(order.created_at).toLocaleDateString(
        request.locale === 'fr' ? 'fr-FR' : 'en-US',
        { year: 'numeric', month: 'short', day: 'numeric' }
      );
      const amount = `${order.total_amount} ${order.currency}`;
      // Emit relative path for in-app navigation
      const reorderLink = `/orders/${order.id}/reorder`;
      formatted.push(
        `- **${order.business.name}** (${date}) - ${amount} [Reorder](${reorderLink})`
      );
    }

    formatted.push(
      `\nTap "Reorder" to add these items to your cart at current prices.`
    );

    return { content: formatted.join('\n') };
  }

  private searchCatalogTool(): Tool {
    return {
      toolSpec: {
        name: 'search_catalog',
        description:
          'Search the product catalog for items available in the customer\'s market. Returns products with links, prices, and categories. Use when the customer expresses buy or availability intent. Always clarify the product if vague.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Product search query (name, category, brand, etc.)',
              },
            },
            required: ['query'],
          },
        },
      },
    };
  }

  private knowledgeTool(): Tool {
    return {
      toolSpec: {
        name: 'get_knowledge',
        description:
          'Get curated Rendasua policy copy (pay-at-delivery process, pickup, support). For live country/state lists and payment systems, prefer list_supported_country_states and list_supported_payment_systems.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              topic: { type: 'string', enum: [...KNOWLEDGE_TOPICS] },
              country: { type: 'string' },
            },
            required: ['topic'],
          },
        },
      },
    };
  }

  private countryStatesTool(): Tool {
    return {
      toolSpec: {
        name: 'list_supported_country_states',
        description:
          'Query live supported_country_states (active/coming_soon). Use for country coverage, regions/states, delivery flags. Optional country_code (ISO-2). If omitted, returns all configured countries.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              country_code: {
                type: 'string',
                description: 'ISO-2 country code, e.g. CM, GA, CA, BR',
              },
            },
          },
        },
      },
    };
  }

  private paymentSystemsTool(): Tool {
    return {
      toolSpec: {
        name: 'list_supported_payment_systems',
        description:
          'Query live supported_payment_systems (active). Use for payment methods/rails by country. Optional country_code (ISO-2). Never invent methods not returned.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              country_code: {
                type: 'string',
                description: 'ISO-2 country code, e.g. CM, GA, CA, BR',
              },
            },
          },
        },
      },
    };
  }

  private humanSupportTool(): Tool {
    return {
      toolSpec: {
        name: 'request_human_support',
        description:
          'Escalate a real customer question that tools/knowledge cannot answer, or a technical/app failure. Do not call for automated messages, acknowledgements, or non-inquiries.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              reason: { type: 'string' },
              issue_type: {
                type: 'string',
                enum: ['technical', 'no_answer', 'other'],
              },
            },
            required: ['reason', 'issue_type'],
          },
        },
      },
    };
  }

  private reorderOptionsTool(): Tool {
    return {
      toolSpec: {
        name: 'get_reorder_options',
        description:
          'Get the customer\'s recent completed orders with reorder deep links. Use when they express reorder intent ("order again", "reorder", "my previous order"). Returns order details with tappable reorder links. Only call for customers with a client profile.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {},
          },
        },
      },
    };
  }

  private userTools(identity: AssistantIdentity): Tool[] {
    const tools: Tool[] = [
      simpleTool('get_my_profile_summary', 'Get the user’s profile summary.'),
    ];
    if (identity.clientId) {
      tools.unshift(
        {
          toolSpec: {
            name: 'get_my_recent_orders',
            description:
              'Get this customer’s up to five most recent orders (order number, status, total, business). Call when they ask about their orders, recent purchases, deliveries, or order history.',
            inputSchema: { json: { type: 'object', properties: {} } },
          },
        },
        {
          toolSpec: {
            name: 'get_order_status',
            description:
              'Look up one of this customer’s orders by order number. Call when they ask about a specific order’s status.',
            inputSchema: {
              json: {
                type: 'object',
                properties: { order_number: { type: 'string' } },
                required: ['order_number'],
              },
            },
          },
        }
      );
    }
    if (
      identity.accountType === 'client' ||
      identity.accountType === 'agent' ||
      identity.accountType === 'business'
    ) {
      tools.push(
        simpleTool('get_my_addresses', 'Get the user’s active saved addresses.')
      );
    }
    return tools;
  }
}

function simpleTool(name: string, description: string): Tool {
  return {
    toolSpec: {
      name,
      description,
      inputSchema: { json: { type: 'object', properties: {} } },
    },
  };
}

const ORDER_FIELDS = `
  id order_number current_status total_amount currency payment_status
  fulfillment_method created_at estimated_delivery_time business { name }
`;

const RECENT_ORDERS_QUERY = `query AssistantRecentOrders($userId: uuid!) {
  orders(
    where: { client: { user_id: { _eq: $userId } } }
    order_by: { created_at: desc }
    limit: 5
  ) { ${ORDER_FIELDS} }
}`;

const ORDER_STATUS_QUERY = `query AssistantOrderStatus(
  $userId: uuid!, $orderNumber: String!
) {
  orders(where: {
    client: { user_id: { _eq: $userId } }
    order_number: { _eq: $orderNumber }
  }, limit: 1) { ${ORDER_FIELDS} }
}`;

const REORDER_OPTIONS_QUERY = `query AssistantReorderOptions($userId: uuid!) {
  orders(
    where: {
      client: { user_id: { _eq: $userId } }
      current_status: { _in: ["complete", "delivered"] }
    }
    order_by: { created_at: desc }
    limit: 5
  ) {
    id order_number current_status total_amount currency created_at
    business { id name }
  }
}`;
