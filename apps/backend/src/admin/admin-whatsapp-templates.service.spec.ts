import { BadRequestException } from '@nestjs/common';
import { AdminWhatsAppTemplatesService } from './admin-whatsapp-templates.service';
import { WhatsAppTemplateService } from '../notifications/orchestration/whatsapp-template.service';

describe('AdminWhatsAppTemplatesService', () => {
  const send = jest.fn();
  const deepLinks = {
    order: (id: string) => ({
      universal: `https://rendasua.com/app/orders/${id}`,
    }),
    rentalRequest: (id: string) => ({
      universal: `https://rendasua.com/app/rentals/requests/${id}`,
    }),
    custom: (app: string) => ({
      universal: `https://rendasua.com/app/${app}`,
    }),
    adminOrder: (id: string) => ({
      universal: `https://rendasua.com/app/admin/orders/${id}`,
    }),
    delivery: (id: string) => ({
      universal: `https://rendasua.com/app/deliveries/${id}`,
    }),
  };
  const channel = {
    isConfigured: jest.fn().mockReturnValue(true),
    featureEnabled: jest.fn().mockReturnValue(false),
    send,
  };
  const service = new AdminWhatsAppTemplatesService(
    new WhatsAppTemplateService(),
    channel as never,
    deepLinks as never
  );

  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({
      channel: 'whatsapp',
      status: 'sent',
      providerMessageId: 'wamid.1',
    });
  });

  it('lists utility templates with accepted ids and example variables', () => {
    const { templates } = service.list('UTILITY');
    const created = templates.find(
      (t) => t.templateKey === 'order_created_business'
    );
    expect(created?.acceptedIds).toContain('rs_order_created');
    expect(created?.exampleVariables).toEqual({
      orderNumber: '<orderNumber>',
      customerName: '<customerName>',
      pickupWindow: '<pickupWindow>',
    });
    expect(templates.every((t) => t.category === 'UTILITY')).toBe(true);
  });

  it('rejects an unknown template id', async () => {
    await expect(
      service.sendTest({
        to: '+15145550123',
        templateId: 'not_a_template',
        variables: {},
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing body variables', async () => {
    await expect(
      service.sendTest({
        to: '+15145550123',
        templateId: 'rs_order_status',
        variables: { orderNumber: '42' },
      })
    ).rejects.toThrow(/statusLabel/);
  });

  it('rejects a dynamic-CTA template without entityId or ctaUrl', async () => {
    await expect(
      service.sendTest({
        to: '+15145550123',
        templateId: 'order_created_business',
        variables: {
          orderNumber: '20123398',
          customerName: 'Ada',
          pickupWindow: '15 min',
        },
      })
    ).rejects.toThrow(/entityId or ctaUrl/);
  });

  it('sends using a Meta name and built order CTA', async () => {
    const entityId = '11111111-2222-4333-8555-666666666666';
    const response = await service.sendTest({
      to: '15145550123',
      templateId: 'rs_order_created',
      locale: 'en',
      entityId,
      variables: {
        orderNumber: '20123398',
        customerName: 'Ada',
        pickupWindow: '15 min',
      },
    });

    expect(response.success).toBe(true);
    expect(response.templateKey).toBe('order_created_business');
    expect(response.metaName).toBe('rs_order_created');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '15145550123',
        ignoreFeatureFlag: true,
        payload: expect.objectContaining({
          templateKey: 'order_created_business',
          ctaUrl: `https://rendasua.com/app/orders/${entityId}`,
        }),
      })
    );
  });

  it('sends verification without a CTA entity id', async () => {
    await service.sendTest({
      to: '+15145550123',
      templateId: 'verification_attention',
      variables: { reason: 'Upload ID' },
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          templateKey: 'verification_attention',
          ctaUrl: undefined,
        }),
      })
    );
  });
});
