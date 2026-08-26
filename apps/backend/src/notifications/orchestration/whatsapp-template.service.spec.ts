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

  it('only ever asks Meta for the two translations we have approved', () => {
    expect(service.languageCode('fr')).toBe('fr');
    expect(service.languageCode('en')).toBe('en');
    expect(service.languageCode(undefined)).toBe('en');
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

describe('WhatsAppTemplateService — authentication templates', () => {
  const service = new WhatsAppTemplateService();

  it('sends the code as the only body param and repeats it on the OTP button', () => {
    const components = service.buildComponents({
      templateKey: 'delivery_pin',
      variables: { pin: '123456', orderNumber: 'ORD-1' },
      ctaUrl: 'https://rendasua.com/app/orders/11111111-2222-4333-8555-666666666666',
    });

    // Meta rejects a second body param on authentication templates, and the
    // button carries the code rather than the order id from the CTA.
    expect(components).toEqual([
      {
        type: 'body',
        parameters: [{ type: 'text', text: '123456' }],
      },
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: '123456' }],
      },
    ]);
  });

  it('sends nothing when the code is missing', () => {
    expect(
      service.buildComponents({
        templateKey: 'delivery_pin',
        variables: { pin: '  ', orderNumber: 'ORD-1' },
      })
    ).toEqual([]);
  });

  it('reports the category so ops can tell auth templates apart', () => {
    const catalog = service.listTemplateCatalog();
    const pin = catalog.find((t) => t.templateKey === 'delivery_pin');
    const status = catalog.find((t) => t.templateKey === 'order_status_client');

    expect(pin).toEqual({
      templateKey: 'delivery_pin',
      metaNameEn: 'rs_delivery_pin',
      metaNameFr: 'rs_delivery_pin',
      bodyVariables: ['pin'],
      category: 'AUTHENTICATION',
    });
    expect(status?.category).toBe('UTILITY');
  });

  it('reports the agent delivery offer as marketing', () => {
    expect(service.category('order_offer_agent')).toBe('MARKETING');
    expect(service.category('order_status_client')).toBe('UTILITY');
  });
});
