jest.mock('./provisioning/business-provisioning.service', () => ({
  BusinessProvisioningService: class BusinessProvisioningService {},
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
jest.mock('../addresses/addresses.service', () => ({
  AddressesService: class AddressesService {},
}));

import { LoginService } from './login.service';

function unsignedJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'none', typ: 'JWT' })
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

describe('LoginService OTP merchant agreement gating', () => {
  const tokenData = {
    access_token: 'access',
    id_token: unsignedJwt({ sub: 'auth0|user-1', email: 'shop@example.com' }),
    token_type: 'Bearer',
    expires_in: 3600,
  };

  let hasuraSystemService: {
    executeQuery: jest.Mock;
    executeMutation: jest.Mock;
  };
  let auth0Service: {
    isTestUsersEnabled: jest.Mock;
    verifyEmailOtp: jest.Mock;
    verifySmsOtp: jest.Mock;
    verifyTestUserEmail: jest.Mock;
    verifyTestUserPhone: jest.Mock;
  };
  let businessProvisioning: {
    ensureContractForUser: jest.Mock;
  };
  let service: LoginService;
  const lockout = {
    isLockedOut: jest.fn().mockResolvedValue(false),
    getRemainingLockoutMs: jest.fn().mockResolvedValue(0),
    recordFailure: jest.fn().mockResolvedValue(undefined),
    recordSuccess: jest.fn().mockResolvedValue(undefined),
  };
  const sessionStore = {
    generateSessionId: jest.fn().mockReturnValue('sid-1'),
    createSession: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    hasuraSystemService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    auth0Service = {
      isTestUsersEnabled: jest.fn().mockReturnValue(false),
      verifyEmailOtp: jest.fn().mockResolvedValue(tokenData),
      verifySmsOtp: jest.fn().mockResolvedValue({
        ...tokenData,
        id_token: unsignedJwt({ sub: 'sms|user-1' }),
      }),
      verifyTestUserEmail: jest.fn(),
      verifyTestUserPhone: jest.fn(),
    };
    businessProvisioning = {
      ensureContractForUser: jest.fn().mockResolvedValue(undefined),
    };
    service = new LoginService(
      hasuraSystemService as never,
      auth0Service as never,
      businessProvisioning as never,
      sessionStore as never,
      lockout as never
    );
  });

  it('ensures merchant contract before marking email verified on login OTP', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      users: [
        {
          id: 'user-1',
          email: 'shop@example.com',
          email_verified: false,
        },
      ],
    });

    const result = await service.verifyLoginOtp(
      { email: ' Shop@Example.COM ', otp: '123456' },
      'mobile'
    );
    expect(result.response.access_token).toBe('access');

    expect(businessProvisioning.ensureContractForUser).toHaveBeenCalledWith(
      'user-1'
    );
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('VerifyLoginEmail'),
      { id: 'user-1' }
    );
    expect(auth0Service.verifyEmailOtp).toHaveBeenCalledWith(
      'shop@example.com',
      '123456'
    );
  });

  it('still marks email verified when contract ensure fails', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      users: [
        {
          id: 'user-1',
          email: 'shop@example.com',
          email_verified: false,
        },
      ],
    });
    businessProvisioning.ensureContractForUser.mockRejectedValue(
      new Error('BoldSign unavailable')
    );

    await service.verifyLoginOtp(
      { email: 'shop@example.com', otp: '123456' },
      'mobile'
    );

    expect(businessProvisioning.ensureContractForUser).toHaveBeenCalledWith(
      'user-1'
    );
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('VerifyLoginEmail'),
      { id: 'user-1' }
    );
  });

  it('skips contract ensure when email is already verified', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      users: [
        {
          id: 'user-1',
          email: 'shop@example.com',
          email_verified: true,
        },
      ],
    });

    await service.verifyLoginOtp(
      { email: 'shop@example.com', otp: '123456' },
      'mobile'
    );

    expect(businessProvisioning.ensureContractForUser).not.toHaveBeenCalled();
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('ensures merchant contract before marking phone verified on SMS login OTP', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      users: [
        {
          id: 'user-2',
          email: '',
          phone_number: '+237600000001',
          email_verified: false,
          phone_number_verified: false,
        },
      ],
    });

    await service.verifyLoginOtp(
      {
        phone_number: '+237600000001',
        otp: '654321',
      },
      'mobile'
    );

    expect(businessProvisioning.ensureContractForUser).toHaveBeenCalledWith(
      'user-2'
    );
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('VerifyLoginPhone'),
      { id: 'user-2' }
    );
  });

  it('still marks phone verified when contract ensure fails', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      users: [
        {
          id: 'user-2',
          email: '',
          phone_number: '+237600000001',
          email_verified: false,
          phone_number_verified: false,
        },
      ],
    });
    businessProvisioning.ensureContractForUser.mockRejectedValue(
      new Error('contract failed')
    );

    await service.verifyLoginOtp(
      {
        phone_number: '+237600000001',
        otp: '654321',
      },
      'mobile'
    );

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('VerifyLoginPhone'),
      { id: 'user-2' }
    );
  });
});
