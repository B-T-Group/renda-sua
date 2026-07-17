import { RatingsCronService } from './ratings-cron.service';

describe('RatingsCronService', () => {
  function buildService(orders: any[]) {
    const executeQuery = jest.fn(async () => ({ orders }));
    const executeMutation = jest.fn(async () => ({
      update_orders_by_pk: { id: 'order-1' },
    }));
    const sendRatePromptPush = jest.fn(async () => undefined);
    const service = new RatingsCronService(
      { executeQuery, executeMutation } as any,
      { sendRatePromptPush } as any,
      { get: jest.fn(() => ({ itemRatingDelayDays: 7 })) } as any
    );
    return { service, executeQuery, executeMutation, sendRatePromptPush };
  }

  const unratedItems = {
    order_items: [{ item_id: 'item-1' }],
    ratings: [],
  };

  it('queries with a cutoff of now minus the configured delay', async () => {
    const { service, executeQuery } = buildService([]);
    const before = Date.now();

    await service.sendPendingItemRatingNudges();

    const variables = executeQuery.mock.calls[0][1] as any;
    const cutoff = new Date(variables.cutoff).getTime();
    const expected = before - 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff - expected)).toBeLessThan(5000);
  });

  it('marks the nudge sent and pushes rate_item to the client', async () => {
    const order = {
      id: 'order-1',
      order_number: 'ORD-1',
      client: { user_id: 'user-1', user: { preferred_language: 'fr' } },
      ...unratedItems,
    };
    const { service, executeMutation, sendRatePromptPush } = buildService([
      order,
    ]);

    const sent = await service.sendPendingItemRatingNudges();

    expect(sent).toBe(1);
    expect(executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('MarkItemRatingNudgeSent'),
      expect.objectContaining({ orderId: 'order-1' })
    );
    expect(sendRatePromptPush).toHaveBeenCalledWith({
      clientUserId: 'user-1',
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      kind: 'rate_item',
      preferredLanguage: 'fr',
    });
  });

  it('nudges partially rated orders (some items still unrated)', async () => {
    const order = {
      id: 'order-partial',
      order_number: 'ORD-P',
      client: { user_id: 'user-1', user: null },
      order_items: [{ item_id: 'item-1' }, { item_id: 'item-2' }],
      ratings: [{ rated_entity_id: 'item-1' }],
    };
    const { service, sendRatePromptPush } = buildService([order]);

    const sent = await service.sendPendingItemRatingNudges();

    expect(sent).toBe(1);
    expect(sendRatePromptPush).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-partial' })
    );
  });

  it('marks fully rated orders as sent without pushing', async () => {
    const order = {
      id: 'order-done',
      order_number: 'ORD-D',
      client: { user_id: 'user-1', user: null },
      order_items: [{ item_id: 'item-1' }],
      ratings: [{ rated_entity_id: 'item-1' }],
    };
    const { service, executeMutation, sendRatePromptPush } = buildService([
      order,
    ]);

    const sent = await service.sendPendingItemRatingNudges();

    expect(sent).toBe(0);
    expect(executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('MarkItemRatingNudgeSent'),
      expect.objectContaining({ orderId: 'order-done' })
    );
    expect(sendRatePromptPush).not.toHaveBeenCalled();
  });

  it('still marks the order when the client user is missing (no push)', async () => {
    const { service, executeMutation, sendRatePromptPush } = buildService([
      { id: 'order-2', order_number: 'ORD-2', client: null, ...unratedItems },
    ]);

    const sent = await service.sendPendingItemRatingNudges();

    expect(sent).toBe(0);
    expect(executeMutation).toHaveBeenCalled();
    expect(sendRatePromptPush).not.toHaveBeenCalled();
  });

  it('continues past per-order failures', async () => {
    const orders = [
      {
        id: 'order-bad',
        order_number: 'ORD-BAD',
        client: { user_id: 'u1', user: null },
        ...unratedItems,
      },
      {
        id: 'order-good',
        order_number: 'ORD-GOOD',
        client: { user_id: 'u2', user: null },
        ...unratedItems,
      },
    ];
    const { service, executeMutation, sendRatePromptPush } =
      buildService(orders);
    executeMutation.mockRejectedValueOnce(new Error('boom'));

    const sent = await service.sendPendingItemRatingNudges();

    expect(sent).toBe(1);
    expect(sendRatePromptPush).toHaveBeenCalledTimes(1);
    expect(sendRatePromptPush).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-good' })
    );
  });
});
