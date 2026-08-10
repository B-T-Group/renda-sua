import { WhatsAppTemplateService } from './whatsapp-template.service';

describe('WhatsAppTemplateService', () => {
  const service = new WhatsAppTemplateService();

  it('resolves Meta template names by locale', () => {
    expect(service.resolveMetaName('order_status_client', 'en')).toBe(
      'rs_order_status'
    );
    expect(service.resolveMetaName('order_status_client', 'fr')).toBe(
      'rs_order_status'
    );
    expect(service.resolveMetaName('missing_key', 'en')).toBeNull();
  });

  it('maps language codes for Meta', () => {
    expect(service.languageCode('fr')).toBe('fr');
    expect(service.languageCode('en')).toBe('en_US');
    expect(service.languageCode(undefined)).toBe('en_US');
  });

  it('builds ordered body params and dynamic CTA button for UUID paths', () => {
    const components = service.buildComponents({
      templateKey: 'order_status_client',
      variables: {
        orderNumber: 'ORD-1',
        statusLabel: 'Confirmed',
      },
      ctaUrl: 'https://rendasua.com/app/orders/11111111-2222-4333-8555-666666666666',
    });

    expect(components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'ORD-1' },
          { type: 'text', text: 'Confirmed' },
        ],
      },
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [
          {
            type: 'text',
            text: '11111111-2222-4333-8555-666666666666',
          },
        ],
      },
    ]);
  });

  it('omits CTA button param for static verification paths', () => {
    const components = service.buildComponents({
      templateKey: 'verification_attention',
      variables: { reason: 'Upload ID' },
      ctaUrl: 'https://rendasua.com/app/verification',
    });

    expect(components).toEqual([
      {
        type: 'body',
        parameters: [{ type: 'text', text: 'Upload ID' }],
      },
    ]);
  });

  it('skips empty body variable values', () => {
    const components = service.buildComponents({
      templateKey: 'order_ready',
      variables: { orderNumber: '' },
    });
    expect(components).toEqual([]);
  });
});
