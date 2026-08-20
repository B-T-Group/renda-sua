import { Test, TestingModule } from '@nestjs/testing';
import { AdminOrdersController } from './admin-orders.controller';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { OrderRiskService } from './order-risk.service';
import {
  GetAdminOrdersDto,
  OrderStatusFilter,
  RiskLevelFilter,
} from './dto/admin-orders.dto';

describe('AdminOrdersController', () => {
  let controller: AdminOrdersController;
  let hasuraSystemService: { executeQuery: jest.Mock };

  beforeEach(async () => {
    hasuraSystemService = {
      executeQuery: jest.fn().mockResolvedValue({
        orders: [],
        orders_aggregate: { aggregate: { count: 0 } },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOrdersController],
      providers: [
        { provide: HasuraSystemService, useValue: hasuraSystemService },
        {
          provide: OrderRiskService,
          useValue: {
            enrichOrderWithRisk: (order: unknown) => order,
            getRiskLevel: () => 'low',
          },
        },
      ],
    })
      .useMocker(() => ({}))
      .compile();

    controller = module.get(AdminOrdersController);
  });

  it('sends numeric GraphQL Ints when limit and offset arrive as query strings', async () => {
    const query = {
      status: OrderStatusFilter.ALL,
      risk_level: RiskLevelFilter.ALL,
      limit: '50',
      offset: '0',
    } as unknown as GetAdminOrdersDto;

    await controller.getAdminOrders(query);

    expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        limit: 50,
        offset: 0,
      }),
    );
    const variables = hasuraSystemService.executeQuery.mock.calls[0][1];
    expect(typeof variables.limit).toBe('number');
    expect(typeof variables.offset).toBe('number');
  });
});
