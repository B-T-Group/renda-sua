import { BusinessProvisioningService } from './business-provisioning.service';

describe('BusinessProvisioningService contract after OTP', () => {
  let hasuraSystemService: { executeQuery: jest.Mock };
  let businessContractsService: {
    ensureContractForBusiness: jest.Mock;
  };
  let service: BusinessProvisioningService;

  beforeEach(() => {
    jest.clearAllMocks();
    hasuraSystemService = { executeQuery: jest.fn() };
    businessContractsService = {
      ensureContractForBusiness: jest.fn().mockResolvedValue(undefined),
    };
    service = new BusinessProvisioningService(
      hasuraSystemService as never,
      {} as never,
      {} as never,
      {} as never,
      businessContractsService as never,
      {} as never,
      {} as never
    );
  });

  it('ensureContractForUser no-ops when user has no business', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      users_by_pk: { business: null },
    });

    await service.ensureContractForUser('user-client');

    expect(
      businessContractsService.ensureContractForBusiness
    ).not.toHaveBeenCalled();
  });

  it('ensureContractForUser awaits BoldSign ensure for business users', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      users_by_pk: { business: { id: 'biz-1' } },
    });

    await service.ensureContractForUser('user-biz');

    expect(
      businessContractsService.ensureContractForBusiness
    ).toHaveBeenCalledWith('biz-1');
  });

  it('scheduleEnsureContractForUser skips when business lookup fails', async () => {
    hasuraSystemService.executeQuery.mockRejectedValue(new Error('hasura down'));

    await service.scheduleEnsureContractForUser('user-biz');

    expect(
      businessContractsService.ensureContractForBusiness
    ).not.toHaveBeenCalled();
  });

  it('scheduleEnsureContractForUser fire-and-forgets BoldSign for business users', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      users_by_pk: { business: { id: 'biz-9' } },
    });

    await service.scheduleEnsureContractForUser('user-biz');

    expect(
      businessContractsService.ensureContractForBusiness
    ).toHaveBeenCalledWith('biz-9');
  });
});
