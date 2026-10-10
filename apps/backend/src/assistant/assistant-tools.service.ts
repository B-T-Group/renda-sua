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
import { formatPrice } from './assistant-cards';
import { AssistantAccountToolsService } from './assistant-account-tools.service';
import { AssistantAgentToolsService } from './assistant-agent-tools.service';
import { AssistantBusinessToolsService } from './assistant-business-tools.service';
import { AssistantClientToolsService } from './assistant-client-tools.service';
import type {
  AssistantCard,
  AssistantIdentity,
  AssistantLocale,
  AssistantToolResult,
} from './assistant.types';

export type { AssistantToolResult };

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

  private readonly accountTools: AssistantAccountToolsService;
  private readonly clientTools: AssistantClientToolsService;
  private readonly agentTools: AssistantAgentToolsService;
  private readonly businessTools: AssistantBusinessToolsService;

  constructor(
    hasura: HasuraSystemService,
    private readonly marketsCatalog: AssistantMarketsCatalogService,
    private readonly inventoryItems: InventoryItemsService,
    private readonly appConfig: AppConfigService
  ) {
    this.accountTools = new AssistantAccountToolsService(hasura);
    this.clientTools = new AssistantClientToolsService(hasura);
    this.agentTools = new AssistantAgentToolsService(hasura);
    this.businessTools = new AssistantBusinessToolsService(hasura);
  }

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
    tools.push(...this.clientTools.publicTools());
    if (identity.userId && identity.accountType !== 'delegate') {
      tools.push(...this.accountTools.tools(identity));
      tools.push(...this.clientTools.tools(identity));
      tools.push(...this.agentTools.tools(identity));
      tools.push(...this.businessTools.tools(identity));
    }
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
    if (request.name === 'search_catalog') return this.searchCatalog(request);
    if (request.name === 'request_human_support') return this.handoff(request);
    if (this.clientTools.handles(request.name)) return this.clientTools.run(request);
    if (!request.identity.userId) return { content: 'Authentication is required.' };
    if (this.accountTools.handles(request.name)) {
      return this.accountTools.run(request.name, request.identity, request.locale || 'en');
    }
    if (this.agentTools.handles(request.name)) {
      return this.agentTools.run(request.name, request.identity);
    }
    if (this.businessTools.handles(request.name)) {
      return this.businessTools.run(request.name, request.identity);
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
          imageUrl?: string | null;
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

      return { content: formatted.join('\n'), cards: catalogItemCards(products) };
    } catch (error: any) {
      this.logger.error(`Catalog search failed: ${error.message}`, error.stack);
      return {
        content: 'Unable to search the catalog at this time. Please try again.',
      };
    }
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
          'Get curated copy. Use what_we_offer for what Rendasua is, support_contact for how to reach us, and the other topics for payments, delivery, pickup, and reels. For live country lists and payment rails, prefer list_supported_country_states and list_supported_payment_systems.',
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

}

function catalogItemCards(
  products: Array<{
    inventoryId: string;
    title: string;
    imageUrl?: string | null;
    price: number;
    currency: string;
  }>
): AssistantCard[] {
  return products.slice(0, 6).map((product) => ({
    kind: 'item',
    id: product.inventoryId,
    title: product.title,
    imageUrl: product.imageUrl || null,
    priceLabel: formatPrice(product.price, product.currency),
    href: `/items/${product.inventoryId}`,
  }));
}
