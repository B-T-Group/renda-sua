import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import type { Configuration, WhatsAppConfig } from '../config/configuration';
import type {
  SendWhatsAppTemplateParams,
  WhatsAppGraphMessagesResponse,
  WhatsAppSendMessageResult,
} from './whatsapp.types';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly configService: ConfigService<Configuration>) {
    this.http = axios.create({
      baseURL: `https://graph.facebook.com/${this.config.apiVersion}`,
      timeout: 15000,
    });
  }

  private get config(): WhatsAppConfig {
    return this.configService.get<WhatsAppConfig>('whatsapp') as WhatsAppConfig;
  }

  isConfigured(): boolean {
    const { accessToken, phoneNumberId, appSecret } = this.config;
    return (
      !!accessToken?.trim() &&
      !!phoneNumberId?.trim() &&
      !!appSecret?.trim()
    );
  }

  /**
   * Send a business-initiated WhatsApp Cloud API template message.
   * Requires an approved template and a recipient outside the 24h session window.
   */
  async sendTemplateMessage(
    params: SendWhatsAppTemplateParams
  ): Promise<WhatsAppSendMessageResult> {
    this.assertConfigured();
    const payload = this.buildTemplatePayload(params);
    return this.postMessages(payload, this.endpointFor(params.category));
  }

  /**
   * Send a free-form session text message (allowed within 24h of last customer message).
   */
  async sendSessionText(params: {
    to: string;
    body: string;
  }): Promise<WhatsAppSendMessageResult> {
    this.assertConfigured();
    return this.postMessages({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.normalizePhone(params.to),
      type: 'text',
      text: { preview_url: false, body: params.body },
    });
  }

  /**
   * Marketing templates go through the Marketing Messages API when the WABA has
   * onboarded, which Meta reports delivers materially better than Cloud API.
   * Everything else — authentication, utility, and non-optimized marketing —
   * stays on Cloud API, which is also the safe fallback before onboarding.
   */
  private endpointFor(category?: SendWhatsAppTemplateParams['category']): string {
    const useMarketingApi =
      category === 'MARKETING' && this.config.marketingMessagesApiEnabled;
    return useMarketingApi ? 'marketing_messages' : 'messages';
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'WhatsApp is not configured (access token / phone number id / app secret)'
      );
    }
  }

  private buildTemplatePayload(
    params: SendWhatsAppTemplateParams
  ): Record<string, unknown> {
    const template: Record<string, unknown> = {
      name: params.templateName,
      language: { code: params.languageCode?.trim() || 'en' },
    };
    if (params.components?.length) {
      template.components = params.components;
    }
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.normalizePhone(params.to),
      type: 'template',
      template,
    };
  }

  private normalizePhone(to: string): string {
    return to.trim().replace(/^\+/, '');
  }

  private async postMessages(
    payload: Record<string, unknown>,
    endpoint = 'messages'
  ): Promise<WhatsAppSendMessageResult> {
    const { phoneNumberId, accessToken } = this.config;
    try {
      const { data } = await this.http.post<WhatsAppGraphMessagesResponse>(
        `/${phoneNumberId}/${endpoint}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return this.mapSendResult(data);
    } catch (error: any) {
      throw this.toSendError(error);
    }
  }

  private mapSendResult(
    data: WhatsAppGraphMessagesResponse
  ): WhatsAppSendMessageResult {
    return {
      messagingProduct: data.messaging_product ?? 'whatsapp',
      contacts: (data.contacts ?? []).map((c) => ({
        input: c.input ?? '',
        waId: c.wa_id ?? '',
      })),
      messages: (data.messages ?? []).map((m) => ({
        id: m.id ?? '',
        messageStatus: m.message_status,
      })),
    };
  }

  private toSendError(error: unknown): Error {
    if (!isAxiosError(error)) {
      return error instanceof Error ? error : new Error(String(error));
    }
    const graphMessage =
      (error.response?.data as WhatsAppGraphMessagesResponse | undefined)?.error
        ?.message || error.message;
    this.logger.error(`WhatsApp send failed: ${graphMessage}`);
    return new Error(graphMessage || 'WhatsApp send failed');
  }
}
