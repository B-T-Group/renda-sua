import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../../../config/configuration';
import { WhatsAppService } from '../../../whatsapp/whatsapp.service';
import type { ChannelAttemptResult, WhatsAppChannelPayload } from '../notification.types';
import { WhatsAppTemplateService } from '../whatsapp-template.service';

@Injectable()
export class WhatsAppChannel {
  private readonly logger = new Logger(WhatsAppChannel.name);

  constructor(
    private readonly whatsAppService: WhatsAppService,
    private readonly templateService: WhatsAppTemplateService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  isConfigured(): boolean {
    return this.whatsAppService.isConfigured() && this.featureEnabled();
  }

  featureEnabled(): boolean {
    return (
      this.configService.get<Configuration['whatsapp']>('whatsapp')
        ?.notificationsEnabled !== false
    );
  }

  async send(params: {
    to: string;
    locale?: string;
    payload: WhatsAppChannelPayload;
  }): Promise<ChannelAttemptResult> {
    if (!this.isConfigured()) {
      return {
        channel: 'whatsapp',
        status: 'skipped',
        skippedReason: 'whatsapp_not_configured',
      };
    }
    const templateName = this.templateService.resolveMetaName(
      params.payload.templateKey,
      params.locale
    );
    if (!templateName) {
      return {
        channel: 'whatsapp',
        status: 'failed',
        error: `Unknown template key: ${params.payload.templateKey}`,
      };
    }
    try {
      const result = await this.whatsAppService.sendTemplateMessage({
        to: params.to,
        templateName,
        languageCode: this.templateService.languageCode(params.locale),
        components: this.templateService.buildComponents(params.payload),
      });
      const messageId = result.messages[0]?.id;
      return {
        channel: 'whatsapp',
        status: 'sent',
        providerMessageId: messageId,
      };
    } catch (error: any) {
      this.logger.warn(`WhatsApp send failed: ${error?.message ?? String(error)}`);
      return {
        channel: 'whatsapp',
        status: 'failed',
        error: error?.message ?? String(error),
      };
    }
  }
}
