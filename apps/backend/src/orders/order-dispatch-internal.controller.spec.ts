import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { internalKeyMatches } from './internal-key.util';
import { OrderDispatchInternalController } from './order-dispatch-internal.controller';

const ORDER_ID = '3f2b8c1e-9d4a-4e6b-8a7c-1d2e3f4a5b6c';

describe('OrderDispatchInternalController', () => {
  const offers = { runDispatchRound: jest.fn() };
  const reminder = { sendForOrder: jest.fn() };
  const headsUp = { repingForOrder: jest.fn() };
  const configService = { get: jest.fn() };
  let controller: OrderDispatchInternalController;

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockReturnValue({ apiKey: 'internal-secret' });
    reminder.sendForOrder.mockResolvedValue({ kind: 'sent', recipients: 2 });
    headsUp.repingForOrder.mockResolvedValue({ kind: 'sent', agentIds: ['a1'] });
    controller = new OrderDispatchInternalController(
      offers as never,
      configService as never,
      reminder as never,
      headsUp as never
    );
  });

  describe('QA #608 N4: internal key compare', () => {
    it('internalKeyMatches: exact match only, any length, empty expected never matches', () => {
      expect(internalKeyMatches('internal-secret', 'internal-secret')).toBe(true);
      for (const bad of ['internal-secreT', 'internal-secret ', '', 'x'.repeat(500)]) expect(internalKeyMatches(bad, 'internal-secret')).toBe(false);
      expect(internalKeyMatches(undefined, 'internal-secret')).toBe(false);
      expect(internalKeyMatches('', '')).toBe(false);
    });

    it('compares in constant time (crypto.timingSafeEqual), on both internal endpoints', async () => {
      const spy = jest.spyOn(crypto, 'timingSafeEqual');
      await controller.dedicatedSlotReminder({ orderId: ORDER_ID }, 'internal-secret');
      await controller.dedicatedSlotReminder({ orderId: ORDER_ID }, 'nope').catch(() => undefined);
      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });
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

  describe('dedicated-heads-up-reping', () => {
    it('rejects a missing or wrong internal key', async () => {
      await expect(controller.dedicatedHeadsUpReping({ orderId: ORDER_ID }, undefined)).rejects.toBeInstanceOf(
        UnauthorizedException
      );
      await expect(controller.dedicatedHeadsUpReping({ orderId: ORDER_ID }, 'wrong')).rejects.toBeInstanceOf(
        UnauthorizedException
      );
      expect(headsUp.repingForOrder).not.toHaveBeenCalled();
    });

    it('re-pings the trimmed order id and returns the outcome', async () => {
      await expect(
        controller.dedicatedHeadsUpReping({ orderId: ` ${ORDER_ID} ` }, 'internal-secret')
      ).resolves.toEqual({ success: true, outcome: { kind: 'sent', agentIds: ['a1'] } });
      expect(headsUp.repingForOrder).toHaveBeenCalledWith(ORDER_ID);
    });

    it.each([{}, { orderId: '   ' }, { orderId: '' }])('requires an order id (%j)', async (body) => {
      await expect(controller.dedicatedHeadsUpReping(body, 'internal-secret')).resolves.toEqual({
        success: false,
        error: 'orderId is required',
      });
      expect(headsUp.repingForOrder).not.toHaveBeenCalled();
    });

    it('reports unavailable when the heads-up service is not wired', async () => {
      const bare = new OrderDispatchInternalController(offers as never, configService as never, reminder as never);
      await expect(bare.dedicatedHeadsUpReping({ orderId: ORDER_ID }, 'internal-secret')).resolves.toEqual({
        success: false,
        error: 'unavailable',
      });
      expect(headsUp.repingForOrder).not.toHaveBeenCalled();
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
