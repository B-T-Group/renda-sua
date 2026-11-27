import { HttpException, HttpStatus } from '@nestjs/common';
import { ExportOrdersService } from './export-orders.service';
import type { ExportOrderRow } from './export-orders.types';

describe('ExportOrdersService.isExportOrdersEnabled', () => {
  it('returns false when no config rows', async () => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        application_configurations: [],
      }),
    };
    const service = new ExportOrdersService(
      hasura as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    await expect(service.isExportOrdersEnabled()).resolves.toBe(false);
  });

  it('prefers country row over global', async () => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        application_configurations: [
          { boolean_value: true, country_code: 'CM' },
          { boolean_value: false, country_code: null },
        ],
      }),
    };
    const service = new ExportOrdersService(
      hasura as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    await expect(service.isExportOrdersEnabled('CM')).resolves.toBe(true);
  });
});

describe('ExportOrdersService.getByIdForActor', () => {
  const order: Pick<
    ExportOrderRow,
    'id' | 'client_user_id' | 'agent_user_id' | 'business_id'
  > = {
    id: 'ord-1',
    client_user_id: 'client-a',
    agent_user_id: 'agent-a',
    business_id: 'biz-a',
  };

  function serviceFor(user: {
    id: string;
    business?: { id?: string } | null;
  }) {
    const hasuraUser = { getUser: jest.fn().mockResolvedValue(user) };
    const transitions = { getOrder: jest.fn().mockResolvedValue(order) };
    return {
      hasuraUser,
      transitions,
      service: new ExportOrdersService(
        {} as any,
        hasuraUser as any,
        transitions as any,
        {} as any,
        {} as any
      ),
    };
  }

  async function expectForbidden(
    run: () => Promise<unknown>
  ): Promise<void> {
    try {
      await run();
      fail('expected Forbidden');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  }

  it('returns the order when the client owns it', async () => {
    const { service, transitions } = serviceFor({ id: 'client-a' });
    await expect(service.getByIdForActor('ord-1', 'client')).resolves.toBe(
      order
    );
    expect(transitions.getOrder).toHaveBeenCalledWith('ord-1');
  });

  it('rejects another client reading the same order', async () => {
    const { service } = serviceFor({ id: 'client-b' });
    await expectForbidden(() => service.getByIdForActor('ord-1', 'client'));
  });

  it('returns the order when the caller is the referring agent', async () => {
    const { service } = serviceFor({ id: 'agent-a' });
    await expect(service.getByIdForActor('ord-1', 'agent')).resolves.toBe(
      order
    );
  });

  it('rejects an agent who is not on the order', async () => {
    const { service } = serviceFor({ id: 'agent-b' });
    await expectForbidden(() => service.getByIdForActor('ord-1', 'agent'));
  });

  it('returns the order when the manufacturer owns the business', async () => {
    const { service } = serviceFor({
      id: 'biz-user',
      business: { id: 'biz-a' },
    });
    await expect(service.getByIdForActor('ord-1', 'business')).resolves.toBe(
      order
    );
  });

  it('rejects a manufacturer for another business', async () => {
    const { service } = serviceFor({
      id: 'biz-user',
      business: { id: 'biz-b' },
    });
    await expectForbidden(() => service.getByIdForActor('ord-1', 'business'));
  });

  it('rejects a user with no business row on the manufacturer route', async () => {
    const { service } = serviceFor({ id: 'biz-user' });
    await expectForbidden(() => service.getByIdForActor('ord-1', 'business'));
  });

  it('does not hide a missing order behind Forbidden', async () => {
    const hasuraUser = { getUser: jest.fn().mockResolvedValue({ id: 'client-a' }) };
    const missing = new HttpException(
      'Export order not found',
      HttpStatus.NOT_FOUND
    );
    const transitions = { getOrder: jest.fn().mockRejectedValue(missing) };
    const service = new ExportOrdersService(
      {} as any,
      hasuraUser as any,
      transitions as any,
      {} as any,
      {} as any
    );
    await expect(service.getByIdForActor('missing', 'client')).rejects.toBe(
      missing
    );
  });
});
