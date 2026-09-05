import { BadRequestException, Injectable } from '@nestjs/common';
import { DeepLinkService } from '../notifications/deep-link.service';
import { WhatsAppChannel } from '../notifications/orchestration/channels/whatsapp.channel';
import type { WhatsAppChannelPayload } from '../notifications/orchestration/notification.types';
import type { WhatsAppTemplateCatalogEntry } from '../notifications/orchestration/whatsapp-template.service';
import { WhatsAppTemplateService } from '../notifications/orchestration/whatsapp-template.service';
import { TestWhatsAppTemplateDto } from './dto/test-whatsapp-template.dto';

@Injectable()
export class AdminWhatsAppTemplatesService {
  constructor(
    private readonly templates: WhatsAppTemplateService,
    private readonly whatsAppChannel: WhatsAppChannel,
    private readonly deepLinks: DeepLinkService
  ) {}

  list(category?: string) {
    const templates = this.templates
      .listTemplateCatalog()
      .filter((t) => !category || t.category === category)
      .map((t) => this.toListItem(t));
    return {
      configured: this.whatsAppChannel.isConfigured(),
      featureEnabled: this.whatsAppChannel.featureEnabled(),
      templates,
    };
  }

  async sendTest(dto: TestWhatsAppTemplateDto) {
    const templateKey = this.resolveOrThrow(dto.templateId);
    const variables = this.requireVariables(templateKey, dto.variables);
    const payload: WhatsAppChannelPayload = {
      templateKey,
      variables,
      ctaUrl: this.resolveCta(templateKey, dto),
    };
    const result = await this.whatsAppChannel.send({
      to: dto.to,
      locale: dto.locale,
      payload,
      ignoreFeatureFlag: true,
    });
    return this.toSendResponse(templateKey, dto.locale, payload, result);
  }

  private toListItem(t: WhatsAppTemplateCatalogEntry) {
    return {
      ...t,
      templateId: t.templateKey,
      acceptedIds: [...new Set([t.templateKey, t.metaNameEn, t.metaNameFr])],
      exampleVariables: Object.fromEntries(
        t.bodyVariables.map((key) => [key, `<${key}>`])
      ),
    };
  }

  private resolveOrThrow(templateId: string): string {
    const key = this.templates.resolveTemplateKey(templateId);
    if (!key) {
      throw new BadRequestException(`Unknown WhatsApp template: ${templateId}`);
    }
    return key;
  }

  private requireVariables(
    templateKey: string,
    raw: Record<string, string>
  ): Record<string, string> {
    const variables = this.stringifyVars(raw);
    const missing = this.templates
      .requiredBodyVariables(templateKey)
      .filter((key) => !variables[key]?.trim());
    if (missing.length) {
      throw new BadRequestException(
        `Missing template variables: ${missing.join(', ')}`
      );
    }
    return variables;
  }

  private stringifyVars(
    raw: Record<string, string>
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(raw ?? {}).map(([k, v]) => [k, String(v ?? '')])
    );
  }

  private resolveCta(
    templateKey: string,
    dto: TestWhatsAppTemplateDto
  ): string | undefined {
    if (dto.ctaUrl?.trim()) return dto.ctaUrl.trim();
    if (!this.templates.needsDynamicCta(templateKey)) return undefined;
    const entityId = dto.entityId?.trim();
    if (!entityId) {
      throw new BadRequestException(
        `Template ${templateKey} requires entityId or ctaUrl for the URL button`
      );
    }
    return this.buildCta(templateKey, entityId);
  }

  private buildCta(templateKey: string, entityId: string): string {
    const url = this.ctaUrlFor(templateKey, entityId);
    if (!url) {
      throw new BadRequestException(
        `No default CTA for ${templateKey}; pass ctaUrl`
      );
    }
    return url;
  }

  private ctaUrlFor(templateKey: string, entityId: string): string | null {
    if (this.isOrderCta(templateKey)) {
      return this.deepLinks.order(entityId).universal;
    }
    if (templateKey === 'rental_request_business') {
      return this.deepLinks.rentalRequest(entityId).universal;
    }
    if (templateKey === 'ai_proposal_ready') {
      return this.deepLinks.custom(`items/${entityId}`, `/items/${entityId}`)
        .universal;
    }
    if (templateKey === 'admin_order_risk') {
      return this.deepLinks.adminOrder(entityId).universal;
    }
    if (templateKey === 'order_offer_agent') {
      return this.deepLinks.delivery(entityId).universal;
    }
    return null;
  }

  private isOrderCta(templateKey: string): boolean {
    return [
      'order_created_business',
      'order_status_client',
      'order_ready',
      'pickup_reminder',
      'payment_failed',
    ].includes(templateKey);
  }

  private toSendResponse(
    templateKey: string,
    locale: string | undefined,
    payload: WhatsAppChannelPayload,
    result: Awaited<ReturnType<WhatsAppChannel['send']>>
  ) {
    return {
      success: result.status === 'sent',
      templateKey,
      metaName: this.templates.resolveMetaName(templateKey, locale),
      languageCode: this.templates.languageCode(locale),
      category: this.templates.category(templateKey),
      components: this.templates.buildComponents(payload),
      result,
    };
  }
}
