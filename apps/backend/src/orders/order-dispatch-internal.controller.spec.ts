import { UnauthorizedException } from '@nestjs/common';
import { OrderDispatchInternalController } from './order-dispatch-internal.controller';

const ORDER_ID = '3f2b8c1e-9d4a-4e6b-8a7c-1d2e3f4a5b6c';

describe('OrderDispatchInternalController', () => {
  const offers = { runDispatchRound: jest.fn() };
  const reminder = { sendForOrder: jest.fn() };
  const configService = { get: jest.fn() };
  let controller: OrderDispatchInternalController;

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockReturnValue({ apiKey: 'internal-secret' });
    reminder.sendForOrder.mockResolvedValue({ kind: 'sent', recipients: 2 });
    controller = new OrderDispatchInternalController(offers as never, configService as never, reminder as never);
  });

  describe('#594 PR 6 dedicated-slot-reminder (AC-A8)', () => {
    it('rejects a missing or wrong internal key', async () => {
      await expect(controller.dedicatedSlotReminder({ orderId: ORDER_ID }, undefined)).rejects.toBeInstanceOf(
        UnauthorizedException
      );
      await expect(controller.dedicatedSlotReminder({ orderId: ORDER_ID }, 'wrong')).rejects.toBeInstanceOf(
        UnauthorizedException
      );
      expect(reminder.sendForOrder).not.toHaveBeenCalled();
    });

    it('sends for the trimmed order id and returns the outcome', async () => {
      await expect(
        controller.dedicatedSlotReminder({ orderId: ` ${ORDER_ID} ` }, 'internal-secret')
      ).resolves.toEqual({ success: true, outcome: { kind: 'sent', recipients: 2 } });
      expect(reminder.sendForOrder).toHaveBeenCalledWith(ORDER_ID);
    });

    it('requires an order id', async () => {
      await expect(controller.dedicatedSlotReminder({}, 'internal-secret')).resolves.toEqual({
        success: false,
        error: 'orderId is required',
      });
      expect(reminder.sendForOrder).not.toHaveBeenCalled();
    });
  });

  it('dispatch-round keeps its key check and delegation', async () => {
    await expect(controller.dispatchRound({ orderId: ORDER_ID, round: 2 }, 'nope')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    await expect(controller.dispatchRound({ orderId: ORDER_ID, round: 2 }, 'internal-secret')).resolves.toEqual({
      success: true,
    });
    expect(offers.runDispatchRound).toHaveBeenCalledWith(ORDER_ID, 2);
  });
});
