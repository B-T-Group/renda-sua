import { Test, TestingModule } from '@nestjs/testing';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  metaUserTypeFromPersona,
  ORDER_PAID_EVENT,
} from './meta-conversions.constants';
import { MetaConversionsClientService } from './meta-conversions-client.service';
import { MetaConversionsService } from './meta-conversions.service';
import { OrderPaidMetaListener } from './order-paid-meta.listener';

describe('OrderPaidMetaListener', () => {
  let listener: OrderPaidMetaListener;
  let trackPurchaseSafe: jest.Mock;

  beforeEach(async () => {
    trackPurchaseSafe = jest.fn().mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderPaidMetaListener,
        {
          provide: MetaConversionsService,
          useValue: { trackPurchaseSafe },
        },
      ],
    }).compile();
    listener = module.get(OrderPaidMetaListener);
  });

  it('calls trackPurchaseSafe on order.paid', async () => {
    await listener.handle({ orderId: 'ord-1' });
    expect(trackPurchaseSafe).toHaveBeenCalledWith('ord-1');
  });

  it('skips when orderId missing', async () => {
    await listener.handle({ orderId: '' });
    expect(trackPurchaseSafe).not.toHaveBeenCalled();
  });
});

describe('MetaConversionsService', () => {
  let service: MetaConversionsService;
  let sendEvents: jest.Mock;
  let isConfigured: jest.Mock;
  let executeQuery: jest.Mock;

  beforeEach(async () => {
    sendEvents = jest.fn().mockResolvedValue(undefined);
    isConfigured = jest.fn().mockReturnValue(true);
    executeQuery = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetaConversionsService,
        {
          provide: MetaConversionsClientService,
          useValue: {
            isConfigured,
            sendEvents,
            getTestEventCode: () => '',
          },
        },
        {
          provide: HasuraSystemService,
          useValue: { executeQuery },
        },
      ],
    }).compile();
    service = module.get(MetaConversionsService);
  });

  it('no-ops Purchase when not configured', async () => {
    isConfigured.mockReturnValue(false);
    await service.trackPurchaseForOrderId('ord-1');
    expect(executeQuery).not.toHaveBeenCalled();
    expect(sendEvents).not.toHaveBeenCalled();
  });

  it('builds Purchase payload from order', async () => {
    executeQuery.mockResolvedValue({
      orders_by_pk: {
        id: 'ord-1',
        order_number: 'RS-1',
        total_amount: 50,
        currency: 'USD',
        order_items: [
          {
            business_inventory_id: 'inv-1',
            quantity: 2,
            unit_price: 25,
          },
        ],
        client: {
          user_id: 'user-1',
          user: {
            email: 'a@b.com',
            phone_number: '+15551212',
            first_name: 'A',
            last_name: 'B',
          },
        },
      },
    });
    await service.trackPurchaseForOrderId('ord-1');
    expect(sendEvents).toHaveBeenCalled();
    const payload = sendEvents.mock.calls[0][0];
    expect(payload.data[0].event_name).toBe('Purchase');
    expect(payload.data[0].event_id).toBe('purchase-ord-1');
    expect(payload.data[0].custom_data.content_ids).toEqual(['inv-1']);
    expect(payload.data[0].custom_data.value).toBe(50);
    expect(payload.data[0].user_data.em).toBeDefined();
  });

  it('trackViewContentSafe sends ViewContent', async () => {
    await service.trackViewContentSafe({
      eventId: 'ev-1',
      actionSource: 'website',
      inventoryItemId: 'inv-1',
      value: 10,
      currency: 'USD',
    });
    expect(sendEvents).toHaveBeenCalled();
    expect(sendEvents.mock.calls[0][0].data[0].event_name).toBe('ViewContent');
  });

  it('enriches ViewContent with hashed PII for UUID externalId', async () => {
    executeQuery.mockResolvedValue({
      users_by_pk: {
        email: 'shopper@example.com',
        phone_number: '+15551234567',
        first_name: 'Sam',
        last_name: 'Lee',
      },
    });
    await service.trackViewContentSafe({
      eventId: 'ev-2',
      actionSource: 'website',
      inventoryItemId: 'inv-1',
      externalId: '11111111-1111-4111-8111-111111111111',
      allowUserEnrichment: true,
      fbc: 'fb.1.123.abc',
      fbp: 'fb.1.123.xyz',
      clientIpAddress: '203.0.113.10',
      clientUserAgent: 'TestAgent',
    });
    expect(executeQuery).toHaveBeenCalled();
    const userData = sendEvents.mock.calls[0][0].data[0].user_data;
    expect(userData.em).toBeDefined();
    expect(userData.ph).toBeDefined();
    expect(userData.fbc).toBe('fb.1.123.abc');
    expect(userData.fbp).toBe('fb.1.123.xyz');
    expect(userData.client_ip_address).toBe('203.0.113.10');
  });

  it('skips user enrichment without allowUserEnrichment even for UUID', async () => {
    await service.trackViewContentSafe({
      eventId: 'ev-2b',
      actionSource: 'website',
      inventoryItemId: 'inv-1',
      externalId: '11111111-1111-4111-8111-111111111111',
    });
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it('skips user enrichment for non-UUID externalId', async () => {
    await service.trackViewContentSafe({
      eventId: 'ev-3',
      actionSource: 'app',
      inventoryItemId: 'inv-1',
      externalId: 'anon-abc',
      allowUserEnrichment: true,
    });
    expect(executeQuery).not.toHaveBeenCalled();
    expect(sendEvents).toHaveBeenCalled();
  });

  it('trackCompleteRegistrationSafe sends CompleteRegistration with user_type', async () => {
    await service.trackCompleteRegistrationSafe({
      eventId: 'registration-user-1',
      actionSource: 'app',
      userType: 'delivery_agent',
      externalId: 'user-1',
      email: 'agent@example.com',
      firstName: 'Ada',
      lastName: 'Agent',
    });
    expect(sendEvents).toHaveBeenCalled();
    const event = sendEvents.mock.calls[0][0].data[0];
    expect(event.event_name).toBe('CompleteRegistration');
    expect(event.custom_data.status).toBe(true);
    expect(event.custom_data.user_type).toBe('delivery_agent');
    expect(event.custom_data.content_name).toBe('delivery_agent');
    expect(event.user_data.em).toBeDefined();
  });
});

describe('ORDER_PAID_EVENT', () => {
  it('is order.paid', () => {
    expect(ORDER_PAID_EVENT).toBe('order.paid');
  });
});

describe('metaUserTypeFromPersona', () => {
  it('maps personas to Meta user_type values', () => {
    expect(metaUserTypeFromPersona('client')).toBe('client');
    expect(metaUserTypeFromPersona('agent')).toBe('delivery_agent');
    expect(metaUserTypeFromPersona('business')).toBe('business');
  });
});
