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

@Injectable()
export class AssistantService implements OnModuleInit {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly config: ConfigService<Configuration>,
    private readonly bedrock: BedrockLunaService,
    private readonly tools: AssistantToolsService
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
    if (this.isTechnicalIssue(input)) return this.fallback(input.channel, locale, true);
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
    const maxLoops = Math.max(1, settings?.maxToolIterations || 5);
    for (let index = 0; index < maxLoops; index++) {
      const result = await this.bedrock.converseWithTools({
        model: settings?.model || undefined,
        system: this.systemPrompt(input, locale),
        messages,
        toolConfig: this.tools.buildToolConfig(input.identity),
        maxTokens: 700,
        temperature: 0.2,
      });
      if (!result.toolUses.length) {
        if (await this.injectKnowledgeIfNeeded(input, locale, messages, usedKnowledge)) {
          usedKnowledge = true;
          continue;
        }
        return this.finalize(result.text, handoff, input.channel, locale);
      }
      messages.push({ role: 'assistant', content: result.assistantContent });
      const executed = await this.executeTools(result.toolUses, input, locale);
      usedKnowledge ||= executed.usedKnowledge;
      handoff ||= executed.handoff;
      messages.push({ role: 'user', content: executed.content });
    }
    return this.fallback(input.channel, locale, false);
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
    if (/\b(pix|stripe|mobile\s*money|momo|airtel|moov|mtn|orange|card|carte|paiement|payment)\b/i.test(text)) {
      return 'payments';
    }
    return 'markets';
  }

  private inferCountryCode(text: string): string | null {
    if (/\b(brazil|br[eé]sil)\b/i.test(text)) return 'BR';
    if (/\b(canada)\b/i.test(text)) return 'CA';
    if (/\b(gabon)\b/i.test(text)) return 'GA';
    if (/\b(cameroon|cameroun)\b/i.test(text)) return 'CM';
    if (/\b(united\s*states|u\.s\.a\.|usa|états?-unis|etats?-unis)\b/i.test(text)) {
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
  ): Promise<{ content: ContentBlock[]; handoff: boolean; usedKnowledge: boolean }> {
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
    if (!messages.length) messages.push({ role: 'user', content: [{ text: 'Hello' }] });
    if (messages[0].role !== 'user') {
      messages.unshift({ role: 'user', content: [{ text: 'Hello' }] });
    }
    return messages;
  }

  private systemPrompt(
    input: Omit<AssistantChatInput, 'locale'>,
    locale: AssistantLocale
  ): string {
    const name = input.identity.firstName
      ? `Address the customer naturally as ${input.identity.firstName}.`
      : 'Do not invent a customer name.';
    return `You are Rendasua's professional customer assistant. ${name}
Mirror the customer's language; the current language is ${locale}.
Use tools for company facts and private account data. Never invent information.
Before answering about countries, markets, coverage, regions/states, or payment methods/rails (including short follow-ups like "and Brazil?"), you MUST call list_supported_country_states and/or list_supported_payment_systems. Answer only from those tool results. Use get_knowledge for process copy (pay-at-delivery, pickup, support), not as the sole source of live country lists.
If a country is not returned as configured/active, say we are not available there yet. Never invent local payment methods (for example Pix) or claim Groupe BT presence equals Rendasua availability.
When the customer asks about their orders, recent purchases, deliveries, or a specific order number, call get_my_recent_orders or get_order_status (only available when those tools are provided).
If no answer is available, request human support and say we will get back shortly.
For app errors, bugs, or payment failures, request human support and say the technical team will investigate.
Be concise and never expose internal tools or implementation details.
Never include chain-of-thought, scratchpads, or tags such as <thinking>, <reasoning>, or similar metadata in the reply — output only the customer-facing message.`;
  }

  private resolveLocale(
    input: Omit<AssistantChatInput, 'locale'>,
    hint?: AssistantLocale | null
  ): AssistantLocale {
    const latest = [...input.messages].reverse().find((item) => item.role === 'user');
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
    if (!cleaned) {
      // Empty model output: ask for follow-up, not the technical-failure copy.
      return this.fallback(channel, locale, false);
    }
    return { reply: this.cap(cleaned, channel), handoff, locale };
  }

  private fallback(
    channel: AssistantChatInput['channel'],
    locale: AssistantLocale,
    isTechnical: boolean
  ): AssistantReply {
    const text = isTechnical ? TECHNICAL_FAILURE[locale] : GET_BACK_SHORTLY[locale];
    return { reply: this.cap(text, channel), handoff: true, locale };
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
