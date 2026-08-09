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
    const { accessToken, phoneNumberId } = this.config;
    return !!accessToken?.trim() && !!phoneNumberId?.trim();
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
    return this.postMessages(payload);
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'WhatsApp is not configured (access token / phone number id)'
      );
    }
  }

  private buildTemplatePayload(
    params: SendWhatsAppTemplateParams
  ): Record<string, unknown> {
    const template: Record<string, unknown> = {
      name: params.templateName,
      language: { code: params.languageCode?.trim() || 'en_US' },
    };
    if (params.components?.length) {
      template.components = params.components;
    }
    return {
      messaging_product: 'whatsapp',
      to: this.normalizePhone(params.to),
      type: 'template',
      template,
    };
  }

  private normalizePhone(to: string): string {
    return to.trim().replace(/^\+/, '');
  }

  private async postMessages(
    payload: Record<string, unknown>
  ): Promise<WhatsAppSendMessageResult> {
    const { phoneNumberId, accessToken } = this.config;
    try {
      const { data } = await this.http.post<WhatsAppGraphMessagesResponse>(
        `/${phoneNumberId}/messages`,
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
