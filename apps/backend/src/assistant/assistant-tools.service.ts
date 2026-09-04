import { Injectable, Logger } from '@nestjs/common';
import type { Tool, ToolConfiguration } from '@aws-sdk/client-bedrock-runtime';
import { HasuraSystemService } from '../hasura/hasura-system.service';
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

@Injectable()
export class AssistantToolsService {
  private readonly logger = new Logger(AssistantToolsService.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  getToolConfig(identity: AssistantIdentity): ToolConfiguration {
    const tools = [this.knowledgeTool(), this.humanSupportTool()];
    if (identity.userId) tools.push(...this.userTools(identity));
    return { tools };
  }

  buildToolConfig(identity: AssistantIdentity): ToolConfiguration {
    return this.getToolConfig(identity);
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
    if (request.name === 'request_human_support') return this.handoff(request);
    if (!request.identity.userId) return { content: 'Authentication is required.' };
    if (
      request.name === 'get_my_recent_orders' ||
      request.name === 'get_order_status'
    ) {
      if (request.identity.accountType !== 'client') {
        return {
          content: 'Order lookup is only available for customer accounts.',
        };
      }
    }
    if (request.name === 'get_my_recent_orders') return this.getOrders(request.identity.userId);
    if (request.name === 'get_order_status') return this.getOrder(request);
    if (request.name === 'get_my_addresses') return this.getAddresses(request.identity);
    if (request.name === 'get_my_profile_summary') return this.getProfile(request.identity);
    return { content: `Unknown tool: ${request.name}`, handoff: true };
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
        description: 'Get authoritative Rendasua company and service information.',
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
    if (identity.accountType === 'client') {
      tools.unshift(
        simpleTool('get_my_recent_orders', 'Get the customer’s five recent orders.'),
        orderStatusTool()
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

function orderStatusTool(): Tool {
  return {
    toolSpec: {
      name: 'get_order_status',
      description: 'Get one customer order by order number.',
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
