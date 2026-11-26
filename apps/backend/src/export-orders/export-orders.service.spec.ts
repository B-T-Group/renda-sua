import { ExportOrdersService } from './export-orders.service';

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
