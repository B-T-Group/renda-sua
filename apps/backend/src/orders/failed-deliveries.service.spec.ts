import { HttpException, HttpStatus } from '@nestjs/common';
import { FailedDeliveriesService } from './failed-deliveries.service';

describe('FailedDeliveriesService contact and address fields', () => {
  const businessUser = {
    id: 'user-1',
    active_persona: 'business' as const,
    business: { id: 'biz-1' },
  };

  function createService(user = businessUser) {
    const hasuraUserService = {
      getUser: jest.fn().mockResolvedValue(user),
    };
    const hasuraSystemService = {
      executeQuery: jest.fn(),
    };
    const service = new FailedDeliveriesService(
      hasuraUserService as any,
      hasuraSystemService as any,
      {} as any,
      {} as any,
      {} as any
    );
    return { service, hasuraUserService, hasuraSystemService };
  }

  function expectContactAndAddressFields(query: string) {
    expect(query).toContain('phone_number');
    expect(query).toContain('address_line_1');
    expect(query).toContain('address_line_2');
    expect(query).toContain('postal_code');
    expect(query).toContain('delivery_address');
  }

  it('forbids listing failed deliveries for another business', async () => {
    const { service, hasuraSystemService } = createService();
    await expect(service.getFailedDeliveries('other-biz')).rejects.toMatchObject(
      {
        status: HttpStatus.FORBIDDEN,
      }
    );
    expect(hasuraSystemService.executeQuery).not.toHaveBeenCalled();
  });

  it('loads list rows with client/agent phones and delivery address', async () => {
    const { service, hasuraSystemService } = createService();
    const rows = [{ id: 'fd-1' }];
    hasuraSystemService.executeQuery.mockResolvedValue({
      failed_deliveries: rows,
    });

    await expect(service.getFailedDeliveries('biz-1')).resolves.toEqual(rows);

    const [query, variables] = hasuraSystemService.executeQuery.mock.calls[0];
    expect(variables).toEqual({ businessId: 'biz-1' });
    expectContactAndAddressFields(String(query));
    expect(String(query)).toContain('GetFailedDeliveries');
  });

  it('loads detail with phones/address and enforces business ownership', async () => {
    const { service, hasuraSystemService } = createService();
    hasuraSystemService.executeQuery.mockResolvedValue({
      failed_deliveries: [
        {
          id: 'fd-1',
          order: { business_id: 'biz-1' },
        },
      ],
    });

    await expect(service.getFailedDelivery('order-1')).resolves.toEqual({
      id: 'fd-1',
      order: { business_id: 'biz-1' },
    });

    const [query, variables] = hasuraSystemService.executeQuery.mock.calls[0];
    expect(variables).toEqual({ orderId: 'order-1' });
    expectContactAndAddressFields(String(query));
    expect(String(query)).toContain('GetFailedDelivery');
  });

  it('forbids detail access when order belongs to another business', async () => {
    const { service, hasuraSystemService } = createService();
    hasuraSystemService.executeQuery.mockResolvedValue({
      failed_deliveries: [
        {
          id: 'fd-1',
          order: { business_id: 'other-biz' },
        },
      ],
    });

    try {
      await service.getFailedDelivery('order-1');
      fail('expected forbidden');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('returns 404 when failed delivery is missing', async () => {
    const { service, hasuraSystemService } = createService();
    hasuraSystemService.executeQuery.mockResolvedValue({
      failed_deliveries: [],
    });

    try {
      await service.getFailedDelivery('missing');
      fail('expected not found');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
  });
});
