import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ContentBlock, Message } from '@aws-sdk/client-bedrock-runtime';
import { BedrockLunaService } from '../ai/bedrock-luna.service';
import type { Configuration } from '../config/configuration';
import { GET_BACK_SHORTLY, TECHNICAL_FAILURE } from './assistant-fallback';
import { sanitizeAssistantReply } from './sanitize-assistant-reply';
import { AssistantToolsService } from './assistant-tools.service';
import type {
  AssistantChatInput,
  AssistantLocale,
  AssistantReply,
  AssistantTurnInput,
} from './assistant.types';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly config: ConfigService<Configuration>,
    private readonly bedrock: BedrockLunaService,
    private readonly tools: AssistantToolsService
  ) {}

  isEnabled(): boolean {
    return this.config.get('assistant.enabled', { infer: true }) === true;
  }

  isWhatsAppRepliesEnabled(): boolean {
    const settings = this.config.get('assistant', { infer: true });
    return settings?.enabled === true && settings.whatsappRepliesEnabled === true;
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
        return this.finalize(result.text, handoff, input.channel, locale);
      }
      messages.push({ role: 'assistant', content: result.assistantContent });
      const executed = await this.executeTools(result.toolUses, input, locale);
      handoff ||= executed.handoff;
      messages.push({ role: 'user', content: executed.content });
    }
    return this.fallback(input.channel, locale, false);
  }

  private async executeTools(
    uses: Array<{
      toolUseId: string;
      name: string;
      input: Record<string, unknown>;
    }>,
    input: Omit<AssistantChatInput, 'locale'>,
    locale: AssistantLocale
  ): Promise<{ content: ContentBlock[]; handoff: boolean }> {
    const content: ContentBlock[] = [];
    let handoff = false;
    for (const use of uses) {
      const result = await this.tools.executeTool({
        name: use.name,
        input: use.input,
        identity: input.identity,
        locale,
      });
      handoff ||= !!result.handoff;
      content.push({
        toolResult: {
          toolUseId: use.toolUseId,
          content: [{ text: result.content }],
          status: 'success',
        },
      });
    }
    return { content, handoff };
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
