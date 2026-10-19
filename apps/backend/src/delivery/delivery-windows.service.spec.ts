import { HttpException, HttpStatus } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  CONFIRM_DELIVERY_WINDOW_MUTATION,
  DeliveryWindowsService,
} from './delivery-windows.service';

describe('DeliveryWindowsService.confirmDeliveryWindow', () => {
  const orderId = '22222222-2222-4222-8222-222222222222';
  const userId = '11111111-1111-4111-8111-111111111111';
  const window = {
    id: '33333333-3333-4333-8333-333333333333',
    order_id: orderId,
    is_confirmed: true,
  };

  let hasura: { executeQuery: jest.Mock };
  let service: DeliveryWindowsService;

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    service = new DeliveryWindowsService(
      hasura as unknown as HasuraSystemService
    );
  });

  it('sends the caller UUID and a nullable confirmed_by variable', async () => {
    hasura.executeQuery.mockResolvedValue({
      update_delivery_time_windows: { returning: [window] },
    });

    await expect(
      service.confirmDeliveryWindow(orderId, userId)
    ).resolves.toEqual(window);

    expect(CONFIRM_DELIVERY_WINDOW_MUTATION).toContain(
      '$confirmed_by: uuid'
    );
    expect(CONFIRM_DELIVERY_WINDOW_MUTATION).not.toContain(
      '$confirmed_by: uuid!'
    );
    expect(hasura.executeQuery).toHaveBeenCalledWith(
      CONFIRM_DELIVERY_WINDOW_MUTATION,
      { order_id: orderId, confirmed_by: userId }
    );
  });

  it('does not bind the system sentinel as a UUID', async () => {
    hasura.executeQuery.mockResolvedValue({
      update_delivery_time_windows: { returning: [window] },
    });

    await service.confirmDeliveryWindow(orderId, 'system');

    expect(hasura.executeQuery).toHaveBeenCalledWith(
      CONFIRM_DELIVERY_WINDOW_MUTATION,
      { order_id: orderId, confirmed_by: null }
    );
  });

  it('returns HTTP 404 when no window exists for the order', async () => {
    hasura.executeQuery.mockResolvedValue({
      update_delivery_time_windows: { returning: [] },
    });

    try {
      await service.confirmDeliveryWindow(orderId, userId);
      fail('expected throw');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(error.message).toBe('Delivery window not found');
    }
  });
});
