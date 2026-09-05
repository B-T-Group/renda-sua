import { Injectable, Logger } from '@nestjs/common';
import type { Tool, ToolConfiguration } from '@aws-sdk/client-bedrock-runtime';
import { HasuraSystemService } from '../hasura/hasura-system.service';
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
    private readonly marketsCatalog: AssistantMarketsCatalogService
  ) {}

  getToolConfig(identity: AssistantIdentity): ToolConfiguration {
    const tools = [
      this.knowledgeTool(),
      this.countryStatesTool(),
      this.paymentSystemsTool(),
      this.humanSupportTool(),
    ];
    if (identity.userId) tools.push(...this.userTools(identity));
    return { tools };
  }

  buildToolConfig(identity: AssistantIdentity): ToolConfiguration {
    return this.getToolConfig(identity);
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
    if (request.name === 'request_human_support') return this.handoff(request);
    if (!request.identity.userId) return { content: 'Authentication is required.' };
    if (
      request.name === 'get_my_recent_orders' ||
      request.name === 'get_order_status'
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
    const locale = request.locale === 'fr' ? 'fr' : 'en';
    const technical = request.input.issue_type === 'technical';
    const guidance = technical
      ? locale === 'fr'
        ? 'Nous contactons notre équipe technique et reviendrons vers vous sous peu.'
        : 'We are contacting our technical team and will get back to you shortly.'
      : locale === 'fr'
        ? 'Nous reviendrons vers vous sous peu.'
        : 'We will get back to you shortly.';
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
        description: 'Escalate technical issues or questions without an answer.',
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
