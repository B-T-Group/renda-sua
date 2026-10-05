import { HasuraSystemService } from '../hasura/hasura-system.service';
import { OrdersService } from './orders.service';
import { WhatsAppRecipientCompleteService } from './whatsapp-recipient-complete.service';

describe('WhatsAppRecipientCompleteService', () => {
  const hasura = { executeQuery: jest.fn() };
  const orders = { completeDiasporaRecipientPickup: jest.fn() };
  const service = new WhatsAppRecipientCompleteService(
    hasura as unknown as HasuraSystemService,
    orders as unknown as OrdersService
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('settles when the sender is the bound recipient', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        notification_events: [{ entity_id: 'order-1' }],
      })
      .mockResolvedValueOnce({
        orders_by_pk: {
          id: 'order-1',
          order_number: 'ORD-1',
          recipient_phone: '+24177123456',
          fulfillment_country: 'GA',
        },
      });
    orders.completeDiasporaRecipientPickup.mockResolvedValue('completed');

    const result = await service.handleComplete({
      fromPhone: '24177123456',
      contextMessageId: 'wamid.1',
    });

    expect(orders.completeDiasporaRecipientPickup).toHaveBeenCalledWith('order-1');
    expect(result.message).toContain('magasin a été payé');
  });

  it('does not settle a different phone', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        notification_events: [{ entity_id: 'order-1' }],
      })
      .mockResolvedValueOnce({
        orders_by_pk: {
          id: 'order-1',
          order_number: 'ORD-1',
          recipient_phone: '+24177123456',
          fulfillment_country: 'GA',
        },
      });

    const result = await service.handleComplete({
      fromPhone: '+15145550000',
      contextMessageId: 'wamid.1',
    });

    expect(orders.completeDiasporaRecipientPickup).not.toHaveBeenCalled();
    expect(result.message).toContain('could not match');
  });

  it('does not settle again when the order is already complete', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        notification_events: [{ entity_id: 'order-1' }],
      })
      .mockResolvedValueOnce({
        orders_by_pk: {
          id: 'order-1',
          order_number: 'ORD-1',
          recipient_phone: '+24177123456',
          fulfillment_country: 'US',
        },
      });
    orders.completeDiasporaRecipientPickup.mockResolvedValue('already_complete');

    const result = await service.handleComplete({
      fromPhone: '+24177123456',
      contextMessageId: 'wamid.1',
    });

    expect(result.message).toContain('already complete');
  });

  it('replies when settlement throws so the webhook still answers', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        notification_events: [{ entity_id: 'order-1' }],
      })
      .mockResolvedValueOnce({
        orders_by_pk: {
          id: 'order-1',
          order_number: 'ORD-1',
          recipient_phone: '+24177123456',
          fulfillment_country: 'GA',
        },
      });
    orders.completeDiasporaRecipientPickup.mockRejectedValue(
      new Error('capture failed')
    );

    const result = await service.handleComplete({
      fromPhone: '+24177123456',
      contextMessageId: 'wamid.1',
    });

    expect(result.handled).toBe(true);
    expect(result.message).toContain("n'a pas pu être terminée");
  });

  it('ignores a tap with no message context', async () => {
    const result = await service.handleComplete({ fromPhone: '+24177123456' });

    expect(hasura.executeQuery).not.toHaveBeenCalled();
    expect(orders.completeDiasporaRecipientPickup).not.toHaveBeenCalled();
    expect(result.handled).toBe(true);
  });
});