import { HttpException, HttpStatus } from '@nestjs/common';
import { emptyRequestContext } from '../auth/request-context';
import { DeliverySlotsService } from './delivery-slots.service';
import { DeliveryWindowsController } from './delivery-windows.controller';
import { DeliveryWindowsService } from './delivery-windows.service';

describe('DeliveryWindowsController.confirmDeliveryWindow', () => {
  const orderId = '22222222-2222-4222-8222-222222222222';
  const userId = '11111111-1111-4111-8111-111111111111';
  const window = { id: 'w1', order_id: orderId, is_confirmed: true };

  let windows: { confirmDeliveryWindow: jest.Mock };
  let controller: DeliveryWindowsController;

  beforeEach(() => {
    windows = { confirmDeliveryWindow: jest.fn() };
    controller = new DeliveryWindowsController(
      {} as DeliverySlotsService,
      windows as unknown as DeliveryWindowsService
    );
  });

  it('passes the request user id to the service', async () => {
    windows.confirmDeliveryWindow.mockResolvedValue(window);

    const result = await controller.confirmDeliveryWindow(
      orderId,
      emptyRequestContext({ userId })
    );

    expect(windows.confirmDeliveryWindow).toHaveBeenCalledWith(orderId, userId);
    expect(result).toEqual({
      success: true,
      deliveryWindow: window,
      message: 'Delivery window confirmed successfully',
    });
  });

  it('rethrows a mapped Hasura 400 instead of wrapping it as 500', async () => {
    windows.confirmDeliveryWindow.mockRejectedValue(
      new HttpException(
        {
          success: false,
          statusCode: 400,
          message: 'Invalid identifier',
          error: 'Invalid identifier',
        },
        HttpStatus.BAD_REQUEST
      )
    );

    try {
      await controller.confirmDeliveryWindow(
        orderId,
        emptyRequestContext({ userId: 'system' })
      );
      fail('expected throw');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.message).toBe('Invalid identifier');
    }
  });

  it('includes message on unexpected 500 remaps', async () => {
    windows.confirmDeliveryWindow.mockRejectedValue(
      new Error('Hasura is down')
    );

    try {
      await controller.confirmDeliveryWindow(
        orderId,
        emptyRequestContext({ userId })
      );
      fail('expected throw');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(error.message).toBe('Hasura is down');
      expect(error.getResponse()).toEqual({
        success: false,
        error: 'Hasura is down',
        message: 'Hasura is down',
      });
    }
  });
});
