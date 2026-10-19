import {
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryWindowsController } from './delivery-windows.controller';
import { DeliveryWindowsService } from './delivery-windows.service';

/** #594 DEV QA N3: POST /delivery-windows/:orderId/confirm returned 500 for every call ('system' is not a uuid). */
describe('confirm delivery window (#594 DEV QA N3)', () => {
  const window = {
    id: 'w-1',
    order_id: 'o-1',
    is_confirmed: true,
    confirmed_by: 'u-biz',
  };
  const build = (owner: string | null) => {
    const hasura = {
      executeQuery: jest.fn(
        async (q: string, vars: Record<string, unknown>) => {
          if (q.includes('DeliveryWindowOrderOwner'))
            return {
              orders_by_pk:
                owner === null
                  ? null
                  : { id: vars.id, business: { user_id: owner } },
            };
          if (q.includes('ConfirmDeliveryWindow'))
            return {
              update_delivery_time_windows: {
                returning: [{ ...window, confirmed_by: vars.confirmed_by }],
              },
            };
          throw new Error('unexpected');
        }
      ),
    };
    const service = new DeliveryWindowsService(hasura as any);
    return { hasura, service };
  };
  const confirmCalls = (h: { executeQuery: jest.Mock }) =>
    h.executeQuery.mock.calls.filter(([q]) =>
      String(q).includes('ConfirmDeliveryWindow')
    );

  it('the business owner confirms; confirmed_by is their user id (a uuid), never "system"', async () => {
    const { hasura, service } = build('u-biz');
    await expect(
      service.confirmDeliveryWindowAsBusiness('o-1', 'u-biz')
    ).resolves.toMatchObject({ confirmed_by: 'u-biz' });
    expect(confirmCalls(hasura)).toEqual([
      [expect.any(String), { order_id: 'o-1', confirmed_by: 'u-biz' }],
    ]);
  });

  it('another user gets 403 and nothing is written', async () => {
    const { hasura, service } = build('u-biz');
    await expect(
      service.confirmDeliveryWindowAsBusiness('o-1', 'u-other')
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(confirmCalls(hasura)).toHaveLength(0);
  });

  it('an unknown order is 404', async () => {
    const { service } = build(null);
    await expect(
      service.confirmDeliveryWindowAsBusiness('o-x', 'u-biz')
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('controller: uses the authenticated user and keeps 4xx as 4xx (was always 500)', async () => {
    const { service } = build('u-biz');
    const users = { getUser: jest.fn().mockResolvedValue({ id: 'u-biz' }) };
    const ctrl = new DeliveryWindowsController(
      {} as any,
      service,
      users as any
    );
    await expect(ctrl.confirmDeliveryWindow('o-1')).resolves.toMatchObject({
      success: true,
      deliveryWindow: { confirmed_by: 'u-biz' },
    });
    users.getUser.mockResolvedValue({ id: 'u-other' });
    const err = await ctrl
      .confirmDeliveryWindow('o-1')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(403);
  });
});
