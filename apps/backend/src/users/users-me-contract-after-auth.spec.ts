jest.mock('../addresses/addresses.service', () => ({
  AddressesService: jest.fn(),
}));
jest.mock('../agents/agent-referrals.service', () => ({
  AgentReferralsService: jest.fn(),
}));
jest.mock('../business-referrals/business-referrals.service', () => ({
  BusinessReferralsService: class BusinessReferralsService {},
}));
jest.mock('../business-contracts/business-contracts.service', () => ({
  BusinessContractsService: class BusinessContractsService {},
}));
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../merchant-lifecycle/merchant-lifecycle.service', () => ({
  MerchantLifecycleService: class MerchantLifecycleService {},
}));
jest.mock('../launch-promo/launch-promo.service', () => ({
  LaunchPromoService: class LaunchPromoService {},
}));
jest.mock('../hasura/hasura-system.service', () => ({
  HasuraSystemService: jest.fn(),
}));
jest.mock('../hasura/hasura-user.service', () => ({
  HasuraUserService: jest.fn(),
}));

import { UsersController } from './users.controller';

describe('UsersController Auth0 /me contract sync', () => {
  let controller: UsersController;
  let hasuraUserService: {
    getUser: jest.Mock;
    getUserId: jest.Mock;
  };
  let hasuraSystemService: {
    executeMutation: jest.Mock;
  };
  let businessContractsService: {
    ensureContractForBusiness: jest.Mock;
  };
  let addressesService: {
    resolveCurrencyFromCountry: jest.Mock;
    ensurePersonalAccount: jest.Mock;
  };
  let paymentRoutingService: {
    getUserCountryCode: jest.Mock;
    resolveRailForCountry: jest.Mock;
  };
  let rbacService: {
    getEffectiveAccess: jest.Mock;
  };
  let locationDelegationsFlag: {
    isEnabled: jest.Mock;
  };

  const unverifiedBusinessUser = {
    id: 'user-123',
    email: 'merchant@example.com',
    email_verified: false,
    phone_number: '+237600000001',
    phone_number_verified: false,
    first_name: 'Mer',
    last_name: 'Chant',
    preferred_language: 'en',
    timezone: 'Africa/Douala',
    active_persona: 'business',
    business: { id: 'biz-1' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    hasuraUserService = {
      getUser: jest.fn().mockResolvedValue(unverifiedBusinessUser),
      getUserId: jest.fn().mockReturnValue(unverifiedBusinessUser.id),
    };
    hasuraSystemService = {
      executeMutation: jest.fn().mockResolvedValue({
        update_users_by_pk: { id: unverifiedBusinessUser.id },
      }),
    };
    businessContractsService = {
      ensureContractForBusiness: jest.fn().mockResolvedValue(undefined),
    };
    addressesService = {
      resolveCurrencyFromCountry: jest.fn().mockResolvedValue('XAF'),
      ensurePersonalAccount: jest.fn().mockResolvedValue(false),
    };
    paymentRoutingService = {
      getUserCountryCode: jest.fn().mockResolvedValue(null),
      resolveRailForCountry: jest.fn().mockResolvedValue('mobile_money'),
    };
    rbacService = {
      getEffectiveAccess: jest.fn().mockResolvedValue({
        roles: [],
        permissions: [],
        isSuperuser: false,
      }),
    };
    locationDelegationsFlag = {
      isEnabled: jest.fn().mockResolvedValue(false),
    };

    controller = new UsersController(
      hasuraUserService as never,
      hasuraSystemService as never,
      {} as never,
      addressesService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      paymentRoutingService as never,
      businessContractsService as never,
      rbacService as never,
      {} as never,
      {} as never,
      locationDelegationsFlag as never,
      {} as never
    );
  });

  it('sends merchant agreement then marks email verified for unverified business /me', async () => {
    const result = await controller.getCurrentUser({} as never, {
      sub: 'auth0|merchant',
      email: 'merchant@example.com',
      email_verified: true,
    });

    expect(businessContractsService.ensureContractForBusiness).toHaveBeenCalledWith(
      'biz-1'
    );
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('MarkSignupVerified'),
      {
        id: 'user-123',
        set: { email_verified: true },
      }
    );
    expect(result.user.email_verified).toBe(true);
    expect(result.user.phone_number_verified).toBe(false);
  });

  it('marks phone verified when Auth0 sub is SMS channel', async () => {
    await controller.getCurrentUser({} as never, {
      sub: 'sms|237600000001',
      email: undefined,
      email_verified: false,
    });

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('MarkSignupVerified'),
      {
        id: 'user-123',
        set: { phone_number_verified: true },
      }
    );
  });

  it('does not mark verified when contract ensure fails (allows retry)', async () => {
    businessContractsService.ensureContractForBusiness.mockRejectedValue(
      new Error('BoldSign down')
    );

    const result = await controller.getCurrentUser({} as never, {
      sub: 'auth0|merchant',
      email: 'merchant@example.com',
      email_verified: true,
    });

    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    expect(result.user.email_verified).toBe(false);
  });

  it('skips contract sync when user has no business persona', async () => {
    hasuraUserService.getUser.mockResolvedValue({
      ...unverifiedBusinessUser,
      business: null,
    });

    await controller.getCurrentUser({} as never, {
      sub: 'auth0|client',
      email: 'merchant@example.com',
      email_verified: true,
    });

    expect(
      businessContractsService.ensureContractForBusiness
    ).not.toHaveBeenCalled();
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('skips contract sync when email or phone is already verified', async () => {
    hasuraUserService.getUser.mockResolvedValue({
      ...unverifiedBusinessUser,
      email_verified: true,
    });

    await controller.getCurrentUser({} as never, {
      sub: 'auth0|merchant',
      email: 'merchant@example.com',
      email_verified: true,
    });

    expect(
      businessContractsService.ensureContractForBusiness
    ).not.toHaveBeenCalled();
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });
});
