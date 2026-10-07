import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ContentBlock, Message } from '@aws-sdk/client-bedrock-runtime';
import { BedrockLunaService } from '../ai/bedrock-luna.service';
import type { Configuration } from '../config/configuration';
import { GET_BACK_SHORTLY, TECHNICAL_FAILURE } from './assistant-fallback';
import { needsKnowledgeGrounding } from './needs-knowledge-grounding';
import { sanitizeAssistantReply } from './sanitize-assistant-reply';
import { AssistantToolsService } from './assistant-tools.service';
import type {
  AssistantChatInput,
  AssistantLocale,
  AssistantReply,
  AssistantTurnInput,
} from './assistant.types';
import { SiteEventsService } from '../site-events/site-events.service';
import { emitServerSiteEvent } from '../site-events/server-site-events.helper';

const NO_REPLY_TOKEN = '[[NO_REPLY]]';

@Injectable()
export class AssistantService implements OnModuleInit {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly config: ConfigService<Configuration>,
    private readonly bedrock: BedrockLunaService,
    private readonly tools: AssistantToolsService,
    private readonly siteEvents: SiteEventsService
  ) {}

  onModuleInit(): void {
    const settings = this.config.get('assistant', { infer: true });
    this.logger.log(
      `Assistant config: enabled=${settings?.enabled === true} whatsappReplies=${settings?.whatsappRepliesEnabled === true} envENABLED=${process.env.ASSISTANT_ENABLED} envWA=${process.env.ASSISTANT_WHATSAPP_REPLIES_ENABLED}`
    );
  }

  isEnabled(): boolean {
    return this.config.get('assistant.enabled', { infer: true }) === true;
  }

  isWhatsAppRepliesEnabled(): boolean {
    const enabled =
      this.config.get('assistant.enabled', { infer: true }) === true;
    const whatsappReplies =
      this.config.get('assistant.whatsappRepliesEnabled', { infer: true }) ===
      true;
    return enabled && whatsappReplies;
  }

  chat(input: AssistantChatInput): Promise<AssistantReply> {
    return this.respond(input, input.locale);
  }

  runTurn(input: AssistantTurnInput): Promise<AssistantReply> {
    return this.respond(input, input.localeHint);
  }

  fallbackTechnical(locale: AssistantLocale): string {
    return TECHNICAL_FAILURE[locale];
  }

  fallbackNoAnswer(locale: AssistantLocale): string {
    return GET_BACK_SHORTLY[locale];
  }

  detectLocaleFromText(
    text: string,
    hint?: AssistantLocale | null
  ): AssistantLocale {
    if (looksFrench(text)) return 'fr';
    if (looksEnglish(text)) return 'en';
    return hint === 'fr' ? 'fr' : 'en';
  }

  private async respond(
    input: Omit<AssistantChatInput, 'locale'>,
    localeHint?: AssistantLocale | null
  ): Promise<AssistantReply> {
    const locale = this.resolveLocale(input, localeHint);
    if (this.isTechnicalIssue(input)) {
      return this.fallback(input.channel, locale, true);
    }
    if (!this.isEnabled()) return this.fallback(input.channel, locale, false);
    try {
      return await this.runLoop(input, locale);
    } catch (error: any) {
      this.logger.error(`Assistant chat failed: ${error.message}`, error.stack);
      return this.fallback(input.channel, locale, true);
    }
  }

  private async runLoop(
    input: Omit<AssistantChatInput, 'locale'>,
    locale: AssistantLocale
  ): Promise<AssistantReply> {
    const settings = this.config.get('assistant', { infer: true });
    const messages = this.toMessages(input.messages, settings?.maxHistoryMessages);
    let handoff = false;
    let usedKnowledge = false;
    const toolsUsed = new Set<string>();
    const maxLoops = Math.max(1, settings?.maxToolIterations || 5);
    const toolConfig = await this.tools.buildToolConfig(input.identity);
    const hasShoppingTools = toolConfig.tools?.some(
      (t) => t.toolSpec?.name === 'search_catalog'
    ) ?? false;
    for (let index = 0; index < maxLoops; index++) {
      const result = await this.bedrock.converseWithTools({
        model: settings?.model || undefined,
        system: this.systemPrompt(input, locale, hasShoppingTools),
        messages,
        toolConfig,
        maxTokens: 700,
        temperature: 0.2,
      });
      if (!result.toolUses.length) {
        if (
          await this.injectKnowledgeIfNeeded(
            input,
            locale,
            messages,
            usedKnowledge
          )
        ) {
          usedKnowledge = true;
          continue;
        }
        const reply = this.finalize(result.text, handoff, input.channel, locale);
        this.emitMessageClassified(input, locale, toolsUsed, handoff);
        return reply;
      }
      messages.push({ role: 'assistant', content: result.assistantContent });
      const executed = await this.executeTools(result.toolUses, input, locale);
      result.toolUses.forEach(use => toolsUsed.add(use.name));
      usedKnowledge ||= executed.usedKnowledge;
      handoff ||= executed.handoff;
      messages.push({ role: 'user', content: executed.content });
    }
    this.emitMessageClassified(input, locale, toolsUsed, handoff);
    return this.fallback(input.channel, locale, false, handoff);
  }

  /**
   * Emit assistant.message.classified event for intent share metrics (#451).
   * Intent is derived from tools used and user message content.
   */
  private emitMessageClassified(
    input: Omit<AssistantChatInput, 'locale'>,
    locale: AssistantLocale,
    toolsUsed: Set<string>,
    handoff: boolean
  ): void {
    const intent = this.classifyIntent(input.messages, toolsUsed);
    const threadId = 'threadId' in input ? input.threadId : undefined;
    const market = input.identity.market?.country_code;
    
    const metadata: Record<string, unknown> = {
      intent,
      channel: input.channel,
      locale,
    };
    
    if (market) metadata.market = market;
    if (threadId) metadata.thread_id = threadId;
    
    emitServerSiteEvent(this.siteEvents, 'assistant.message.classified', metadata);
  }

  /**
   * Classify user intent from tools used and message content.
   * Priority order: explicit tool use > message content heuristics > other.
   */
  private classifyIntent(
    messages: AssistantChatInput['messages'],
    toolsUsed: Set<string>
  ): 'buy' | 'availability' | 'reorder' | 'track' | 'support' | 'other' {
    const latest = [...messages].reverse().find((m) => m.role === 'user');
    const text = (latest?.content || '').toLowerCase();
    
    if (toolsUsed.has('search_catalog')) {
      if (/\b(available|availability|disponible|stock|en stock)\b/i.test(text)) {
        return 'availability';
      }
      return 'buy';
    }
    if (toolsUsed.has('get_reorder_options')) return 'reorder';
    if (toolsUsed.has('get_order_status') || toolsUsed.has('get_my_recent_orders')) {
      return 'track';
    }
    if (toolsUsed.has('request_human_support')) return 'support';
    
    if (/\b(buy|purchase|acheter|vendre|order|commande|prix|price|cost|co[uû]t)\b/i.test(text)) {
      return 'buy';
    }
    if (/\b(available|availability|disponible|stock|en stock)\b/i.test(text)) {
      return 'availability';
    }
    if (/\b(reorder|recommander|re-order|again|encore)\b/i.test(text)) {
      return 'reorder';
    }
    if (/\b(track|tracking|where|o[uù]|delivery|livraison|order|commande|status|statut)\b/i.test(text)) {
      return 'track';
    }
    if (/\b(help|aide|support|assist|problem|probl[eè]me)\b/i.test(text)) {
      return 'support';
    }
    
    return 'other';
  }

  private async injectKnowledgeIfNeeded(
    input: Omit<AssistantChatInput, 'locale'>,
    locale: AssistantLocale,
    messages: Message[],
    usedKnowledge: boolean
  ): Promise<boolean> {
    if (usedKnowledge) return false;
    const latest = [...input.messages].reverse().find((m) => m.role === 'user');
    const text = latest?.content || '';
    if (!needsKnowledgeGrounding(text)) return false;
    const catalogTool = this.catalogToolFor(text);
    // Only scope by country named in the message — not WhatsApp/app identity —
    // so broad questions ("Which markets?") return the full catalog.
    const country = this.inferCountryCode(text);
    const catalog = await this.tools.executeTool({
      name: catalogTool,
      input: country ? { country_code: country } : {},
      identity: input.identity,
      locale,
    });
    this.logger.warn(`Assistant grounded via ${catalogTool} (model skipped tools)`);
    messages.push({
      role: 'user',
      content: [{ text: this.groundingNudge(catalogTool, catalog.content) }],
    });
    return true;
  }

  private catalogToolFor(text: string): string {
    return this.knowledgeTopicFor(text) === 'payments'
      ? 'list_supported_payment_systems'
      : 'list_supported_country_states';
  }

  private groundingNudge(source: string, content: string): string {
    return `Authoritative Rendasua data (${source}):\n${content}\nAnswer only from this text. If a country is not listed as configured/active, say Rendasua is not available there yet. Do not invent payment methods.`;
  }

  private knowledgeTopicFor(text: string): 'markets' | 'payments' {
    if (
      /\b(pix|stripe|mobile\s*money|momo|airtel|moov|mtn|orange|card|carte|paiement|payment)\b/i.test(
        text
      )
    ) {
      return 'payments';
    }
    return 'markets';
  }

  private inferCountryCode(text: string): string | null {
    if (/\b(brazil|br[eé]sil)\b/i.test(text)) return 'BR';
    if (/\b(canada)\b/i.test(text)) return 'CA';
    if (/\b(gabon)\b/i.test(text)) return 'GA';
    if (/\b(cameroon|cameroun)\b/i.test(text)) return 'CM';
    if (
      /\b(united\s*states|u\.s\.a\.|usa|états?-unis|etats?-unis)\b/i.test(text)
    ) {
      return 'US';
    }
    return null;
  }

  private async executeTools(
    uses: Array<{
      toolUseId: string;
      name: string;
      input: Record<string, unknown>;
    }>,
    input: Omit<AssistantChatInput, 'locale'>,
    locale: AssistantLocale
  ): Promise<{
    content: ContentBlock[];
    handoff: boolean;
    usedKnowledge: boolean;
  }> {
    const content: ContentBlock[] = [];
    let handoff = false;
    let usedKnowledge = false;
    for (const use of uses) {
      const result = await this.tools.executeTool({
        name: use.name,
        input: use.input,
        identity: input.identity,
        locale,
      });
      if (this.tools.isMarketCatalogTool(use.name)) usedKnowledge = true;
      handoff ||= !!result.handoff;
      content.push({
        toolResult: {
          toolUseId: use.toolUseId,
          content: [{ text: result.content }],
          status: 'success',
        },
      });
    }
    return { content, handoff, usedKnowledge };
  }

  private toMessages(
    history: AssistantChatInput['messages'],
    configuredLimit?: number
  ): Message[] {
    const messages: Message[] = [];
    const limit = Math.max(1, configuredLimit || 10);
    for (const item of history.slice(-limit)) {
      const text = item.content.trim();
      if (!text) continue;
      const role = item.role === 'assistant' ? 'assistant' : 'user';
      const previous = messages[messages.length - 1];
      if (previous?.role === role) previous.content?.push({ text });
      else messages.push({ role, content: [{ text }] });
    }
    if (!messages.length) {
      messages.push({ role: 'user', content: [{ text: 'Hello' }] });
    }
    if (messages[0].role !== 'user') {
      messages.unshift({ role: 'user', content: [{ text: 'Hello' }] });
    }
    return messages;
  }

  private systemPrompt(
    input: Omit<AssistantChatInput, 'locale'>,
    locale: AssistantLocale,
    hasShoppingTools: boolean
  ): string {
    const name = input.identity.firstName
      ? `Address the customer naturally as ${input.identity.firstName}.`
      : 'Do not invent a customer name.';
    
    const market = input.identity.market;
    const marketContext = market
      ? `The customer is in ${market.country_code}${market.state ? ` (${market.state})` : ''}. Never ask which country they are in.`
      : 'The customer market is unknown.';
    
    const shoppingGuidance = hasShoppingTools
      ? `When the customer expresses buy or availability intent ("I want to buy...", "Do you have...", "Show me..."), call search_catalog (clarify the product if vague). Only call list_supported_country_states for explicit coverage questions ("which countries do you serve?"). IMPORTANT: Never claim or guess stock availability unless search_catalog explicitly returned availability data for that specific product. If availability is not in the tool result, do not mention stock status.`
      : market
      ? `When the customer expresses buy or availability intent, clarify what they want to buy, then guide them to search in the app. Never ask which country they are in — you already know.`
      : `When the customer expresses buy or availability intent and you don't know their market, ask which country they are in so you can help them find products.`;
    
    const channelRules =
      input.channel === 'whatsapp'
        ? `WhatsApp channel rules:
Answer only from tool results and knowledge topics (company, markets, payments, delivery, pickup, support; plus the customer's orders/profile when those tools are provided). Never invent information.
If the latest user message is not a Rendasua customer inquiry (automated business replies, away messages, order receipts, thanks/ok, off-topic), or you cannot ground an answer in tools/knowledge, reply with exactly ${NO_REPLY_TOKEN} and nothing else.
Do not greet, acknowledge automated messages, or promise a callback on WhatsApp.
Do not call request_human_support for automated or non-inquiry text. Call it only for a real customer question you cannot answer; after that tool, still reply with exactly ${NO_REPLY_TOKEN} on WhatsApp (no customer-facing handoff copy).`
        : `In-app channel rules:
If no answer is available, request human support and say we will get back shortly.
For app errors, bugs, or payment failures, request human support and say the technical team will investigate.`;
    return `You are Rendasua's professional customer assistant. ${name}
${marketContext}
Mirror the customer's language; the current language is ${locale}.
Use tools for company facts and private account data. Never invent information.
${shoppingGuidance}
Before answering about countries, markets, coverage, regions/states, or payment methods/rails (including short follow-ups like "and Brazil?"), you MUST call list_supported_country_states and/or list_supported_payment_systems. Answer only from those tool results. Use get_knowledge for process copy (pay-at-delivery, pickup, support), not as the sole source of live country lists.
${market && !hasShoppingTools ? `NEVER ask the customer which country they are in or list ISO country codes when they express buy intent. You already know they are in ${market.country_code}.` : ''}
If a country is not returned as configured/active, say we are not available there yet. Never invent local payment methods (for example Pix) or claim Groupe BT presence equals Rendasua availability.
When the customer asks about their orders, recent purchases, deliveries, or a specific order number, call get_my_recent_orders or get_order_status (only available when those tools are provided). When they express reorder intent ("order again", "reorder", "my previous order"), call get_reorder_options (clients only) to show their recent completed orders with reorder links.
${channelRules}
Be concise and never expose internal tools or implementation details.
Never include chain-of-thought, scratchpads, or tags such as <thinking>, <reasoning>, or similar metadata in the reply — output only the customer-facing message.`;
  }

  private resolveLocale(
    input: Omit<AssistantChatInput, 'locale'>,
    hint?: AssistantLocale | null
  ): AssistantLocale {
    const latest = [...input.messages]
      .reverse()
      .find((item) => item.role === 'user');
    return this.detectLocaleFromText(
      latest?.content || '',
      hint || input.identity.preferredLanguage
    );
  }

  private isTechnicalIssue(input: Omit<AssistantChatInput, 'locale'>): boolean {
    const text = input.messages.at(-1)?.content || '';
    return /\b(bug|error|erreur|crash|plantage|technical|technique|not working|ne fonctionne pas|payment failed|paiement échoué)\b/i.test(
      text
    );
  }

  private finalize(
    text: string,
    handoff: boolean,
    channel: AssistantChatInput['channel'],
    locale: AssistantLocale
  ): AssistantReply {
    const cleaned = sanitizeAssistantReply(text);
    if (!cleaned || this.isNoReplyToken(cleaned)) {
      if (channel === 'whatsapp') {
        return { reply: '', handoff, locale, silent: true };
      }
      return this.fallback(channel, locale, false, handoff);
    }
    return {
      reply: this.cap(cleaned, channel),
      handoff,
      locale,
      silent: false,
    };
  }

  private isNoReplyToken(text: string): boolean {
    return text.trim().toUpperCase() === NO_REPLY_TOKEN;
  }

  private fallback(
    channel: AssistantChatInput['channel'],
    locale: AssistantLocale,
    isTechnical: boolean,
    handoff = true
  ): AssistantReply {
    if (channel === 'whatsapp') {
      return { reply: '', handoff, locale, silent: true };
    }
    const text = isTechnical
      ? TECHNICAL_FAILURE[locale]
      : GET_BACK_SHORTLY[locale];
    return {
      reply: this.cap(text, channel),
      handoff: true,
      locale,
      silent: false,
    };
  }

  private cap(text: string, channel: AssistantChatInput['channel']): string {
    if (channel !== 'whatsapp') return text;
    const max =
      this.config.get('assistant.whatsappMaxReplyChars', { infer: true }) || 900;
    return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
  }
}

function looksFrench(text: string): boolean {
  return (
    /[àâçéèêëîïôùûüÿœæ]/i.test(text) ||
    /\b(bonjour|merci|où|livraison|paiement|retrait|aide)\b/i.test(text)
  );
}

function looksEnglish(text: string): boolean {
  return /\b(hello|hi|thanks|please|where|delivery|payment|pickup|help)\b/i.test(
    text
  );
}
