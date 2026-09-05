import { WhatsAppTemplateService } from './whatsapp-template.service';

describe('WhatsAppTemplateService', () => {
  const service = new WhatsAppTemplateService();

  it('resolves an internal key from a Meta template name', () => {
    expect(service.resolveTemplateKey('rs_order_created')).toBe(
      'order_created_business'
    );
    expect(service.resolveTemplateKey('order_status_client')).toBe(
      'order_status_client'
    );
    expect(service.resolveTemplateKey(' missing ')).toBeNull();
  });

  it('flags utility templates that need a dynamic URL button param', () => {
    expect(service.needsDynamicCta('order_created_business')).toBe(true);
    expect(service.needsDynamicCta('verification_attention')).toBe(false);
    expect(service.needsDynamicCta('delivery_pin')).toBe(false);
  });

  it('resolves Meta template names by locale', () => {
    expect(service.resolveMetaName('order_created_business', 'en')).toBe(
      'rs_order_created'
    );
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

  it('always sends every declared body param so Meta #132000 cannot fire on drops', () => {
    const components = service.buildComponents({
      templateKey: 'order_created_business',
      variables: { orderNumber: '20123398', customerName: '', pickupWindow: '15 min' },
      ctaUrl: 'https://rendasua.com/app/orders/e55d335b-233a-49c7-b9ee-d3c7eb941944',
    });
    const body = components.find((c) => c.type === 'body');
    expect(body?.parameters).toEqual([
      { type: 'text', text: '20123398' },
      { type: 'text', text: '-' },
      { type: 'text', text: '15 min' },
    ]);
    expect(components.find((c) => c.type === 'button')?.parameters).toEqual([
      { type: 'text', text: 'e55d335b-233a-49c7-b9ee-d3c7eb941944' },
    ]);
  });

  it('fills an empty single body var instead of omitting the body component', () => {
    const components = service.buildComponents({
      templateKey: 'order_ready',
      variables: { orderNumber: '' },
    });
    expect(components).toEqual([
      {
        type: 'body',
        parameters: [{ type: 'text', text: '-' }],
      },
    ]);
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
      needsDynamicCta: false,
    });
    expect(status?.category).toBe('UTILITY');
  });

  it('reports the agent delivery offer as marketing', () => {
    expect(service.category('order_offer_agent')).toBe('MARKETING');
    expect(service.category('order_status_client')).toBe('UTILITY');
  });
});

describe('WhatsAppTemplateService — recipient templates', () => {
  const service = new WhatsAppTemplateService();

  it('flags recipient templates as having no dynamic CTA', () => {
    expect(service.needsDynamicCta('recipient_order_placed')).toBe(false);
    expect(service.needsDynamicCta('recipient_out_for_delivery')).toBe(false);
    expect(service.needsDynamicCta('recipient_order_ready')).toBe(false);
    expect(service.needsDynamicCta('recipient_order_update')).toBe(false);
  });

  it('builds recipient placed template with payer, store, and order', () => {
    const components = service.buildComponents({
      templateKey: 'recipient_order_placed',
      variables: {
        payerName: 'Jane Doe',
        storeName: 'Acme Store',
        orderNumber: 'ORD-1001',
      },
    });

    expect(components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Jane Doe' },
          { type: 'text', text: 'Acme Store' },
          { type: 'text', text: 'ORD-1001' },
        ],
      },
    ]);
  });

  it('builds recipient out for delivery template with order only', () => {
    const components = service.buildComponents({
      templateKey: 'recipient_out_for_delivery',
      variables: { orderNumber: 'ORD-1001' },
    });

    expect(components).toEqual([
      {
        type: 'body',
        parameters: [{ type: 'text', text: 'ORD-1001' }],
      },
    ]);
  });

  it('builds recipient ready template with order and store', () => {
    const components = service.buildComponents({
      templateKey: 'recipient_order_ready',
      variables: {
        orderNumber: 'ORD-1001',
        storeName: 'Acme Store',
      },
    });

    expect(components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'ORD-1001' },
          { type: 'text', text: 'Acme Store' },
        ],
      },
    ]);
  });

  it('builds recipient update template with order and status label', () => {
    const components = service.buildComponents({
      templateKey: 'recipient_order_update',
      variables: {
        orderNumber: 'ORD-1001',
        statusLabel: 'Confirmed',
      },
    });

    expect(components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'ORD-1001' },
          { type: 'text', text: 'Confirmed' },
        ],
      },
    ]);
  });
});
