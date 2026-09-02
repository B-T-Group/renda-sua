import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../../../config/configuration';
import { WhatsAppService } from '../../../whatsapp/whatsapp.service';
import type {
  ChannelAttemptResult,
  WhatsAppChannelPayload,
} from '../notification.types';
import { WhatsAppInboxPersistenceService } from '../whatsapp-inbox-persistence.service';
import { WhatsAppTemplateService } from '../whatsapp-template.service';

@Injectable()
export class WhatsAppChannel {
  private readonly logger = new Logger(WhatsAppChannel.name);

  constructor(
    private readonly whatsAppService: WhatsAppService,
    private readonly templateService: WhatsAppTemplateService,
    private readonly configService: ConfigService<Configuration>,
    private readonly inbox: WhatsAppInboxPersistenceService
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
    /** Admin/ops test sends skip the product WHATSAPP_NOTIFICATIONS_ENABLED flag. */
    ignoreFeatureFlag?: boolean;
  }): Promise<ChannelAttemptResult> {
    const skipped = this.skipReason(params.ignoreFeatureFlag);
    if (skipped) return skipped;
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

  private skipReason(ignoreFeatureFlag?: boolean): ChannelAttemptResult | null {
    if (!ignoreFeatureFlag && !this.featureEnabled()) {
      return {
        channel: 'whatsapp',
        status: 'skipped',
        skippedReason: 'whatsapp_disabled_or_not_configured',
      };
    }
    if (!this.isConfigured()) {
      return {
        channel: 'whatsapp',
        status: 'skipped',
        skippedReason: 'whatsapp_not_configured',
      };
    }
    return null;
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
      const providerMessageId = result.messages[0]?.id;
      await this.recordTemplateOutbound(params, templateName, providerMessageId);
      return {
        channel: 'whatsapp',
        status: 'sent',
        providerMessageId,
      };
    } catch (error: any) {
      this.logger.warn(
        `WhatsApp send failed: ${error?.message ?? String(error)}`,
        {
          templateName,
          templateKey: params.payload.templateKey,
          languageCode,
          components,
        }
      );
      return {
        channel: 'whatsapp',
        status: 'failed',
        error: error?.message ?? String(error),
      };
    }
  }

  private async recordTemplateOutbound(
    params: { to: string; payload: WhatsAppChannelPayload },
    templateName: string,
    wamid?: string
  ): Promise<void> {
    const phone = params.to.replace(/^\+/, '').trim();
    try {
      await this.inbox.persistOutbound({
        waId: phone,
        customerPhone: phone,
        wamid,
        source: 'template',
        type: 'template',
        body: `Template: ${templateName}`,
        rawPayload: {
          templateKey: params.payload.templateKey,
          templateName,
          variables: params.payload.variables ?? {},
        },
        status: 'sent',
      });
    } catch (error: any) {
      this.logger.warn(
        `Failed to persist template outbound: ${error?.message ?? String(error)}`
      );
    }
  }
}
