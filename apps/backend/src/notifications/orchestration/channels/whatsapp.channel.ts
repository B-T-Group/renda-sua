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

  /** True when Graph credentials + app secret are present. */
  isConfigured(): boolean {
    return this.whatsAppService.isConfigured();
  }

  /**
   * Product WhatsApp notifications are off unless the explicit flag is true
   * and access token / phone number id / app secret are all set.
   */
  featureEnabled(): boolean {
    const flagOn =
      this.configService.get<Configuration['whatsapp']>('whatsapp')
        ?.notificationsEnabled === true;
    return flagOn && this.isConfigured();
  }

  async send(params: {
    to: string;
    locale?: string;
    payload: WhatsAppChannelPayload;
  }): Promise<ChannelAttemptResult> {
    if (!this.featureEnabled()) {
      return {
        channel: 'whatsapp',
        status: 'skipped',
        skippedReason: 'whatsapp_disabled_or_not_configured',
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
    return this.deliverTemplate(params, templateName);
  }

  private async deliverTemplate(
    params: {
      to: string;
      locale?: string;
      payload: WhatsAppChannelPayload;
    },
    templateName: string
  ): Promise<ChannelAttemptResult> {
    const languageCode = this.templateService.languageCode(params.locale);
    const components = this.templateService.buildComponents(params.payload);
    try {
      const result = await this.whatsAppService.sendTemplateMessage({
        to: params.to,
        templateName,
        languageCode,
        components,
        category: this.templateService.category(params.payload.templateKey),
      });
      return {
        channel: 'whatsapp',
        status: 'sent',
        providerMessageId: result.messages[0]?.id,
      };
    } catch (error: any) {
      this.logger.warn(`WhatsApp send failed: ${error?.message ?? String(error)}`, {
        templateName,
        templateKey: params.payload.templateKey,
        languageCode,
        components,
      });
      return {
        channel: 'whatsapp',
        status: 'failed',
        error: error?.message ?? String(error),
      };
    }
  }
}
