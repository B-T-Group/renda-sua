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

import { HttpStatus } from '@nestjs/common';
import { LoginService } from './login.service';

function unsignedJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'none', typ: 'JWT' })
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

describe('LoginService start, lockout, and session gates', () => {
  const tokenData = {
    access_token: 'access',
    refresh_token: 'refresh',
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
    isTestEmail: jest.Mock;
    isTestPhone: jest.Mock;
    startEmailOtp: jest.Mock;
    startSmsOtp: jest.Mock;
    verifyEmailOtp: jest.Mock;
    verifySmsOtp: jest.Mock;
    verifyTestUserEmail: jest.Mock;
    verifyTestUserPhone: jest.Mock;
    refreshAccessToken: jest.Mock;
  };
  let sessionStore: {
    generateSessionId: jest.Mock;
    createSession: jest.Mock;
    getSession: jest.Mock;
    rotateSession: jest.Mock;
    updateSession: jest.Mock;
    deleteSession: jest.Mock;
  };
  let lockout: {
    isLockedOut: jest.Mock;
    getRemainingLockoutMs: jest.Mock;
    recordFailure: jest.Mock;
    recordSuccess: jest.Mock;
  };
  let service: LoginService;

  beforeEach(() => {
    jest.clearAllMocks();
    hasuraSystemService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    auth0Service = {
      isTestUsersEnabled: jest.fn().mockReturnValue(false),
      isTestEmail: jest.fn().mockReturnValue(false),
      isTestPhone: jest.fn().mockReturnValue(false),
      startEmailOtp: jest.fn().mockResolvedValue(undefined),
      startSmsOtp: jest.fn().mockResolvedValue(undefined),
      verifyEmailOtp: jest.fn().mockResolvedValue(tokenData),
      verifySmsOtp: jest.fn().mockResolvedValue(tokenData),
      verifyTestUserEmail: jest.fn(),
      verifyTestUserPhone: jest.fn(),
      refreshAccessToken: jest.fn(),
    };
    sessionStore = {
      generateSessionId: jest.fn().mockReturnValue('sid-new'),
      createSession: jest.fn().mockResolvedValue(undefined),
      getSession: jest.fn(),
      rotateSession: jest.fn(),
      updateSession: jest.fn().mockResolvedValue(true),
      deleteSession: jest.fn().mockResolvedValue(undefined),
    };
    lockout = {
      isLockedOut: jest.fn().mockResolvedValue(false),
      getRemainingLockoutMs: jest.fn().mockResolvedValue(0),
      recordFailure: jest.fn().mockResolvedValue(undefined),
      recordSuccess: jest.fn().mockResolvedValue(undefined),
    };
    service = new LoginService(
      hasuraSystemService as never,
      auth0Service as never,
      { ensureContractForUser: jest.fn().mockResolvedValue(undefined) } as never,
      sessionStore as never,
      lockout as never
    );
  });

  const userWithBoth = {
    id: 'user-1',
    email: 'shop@example.com',
    phone_number: '+237670000000',
    email_verified: true,
    phone_number_verified: true,
  };

  describe('getLoginOtpOptions', () => {
    it('returns both channels when the user has email and phone', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [userWithBoth],
      });
      const result = await service.getLoginOtpOptions({
        phone_number: '+237670000000',
      });
      expect(result).toMatchObject({
        defaultChannel: 'sms',
        availableChannels: ['email', 'sms'],
        maskedEmail: 'sh***@example.com',
        maskedPhone: '••••••0000',
      });
    });

    it('returns 404 when the user is missing', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });
      await expect(
        service.getLoginOtpOptions({ email: 'missing@example.com' })
      ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });
  });

  describe('startLoginOtp', () => {
    it('rejects both email and phone, or neither', async () => {
      await expect(
        service.startLoginOtp({
          email: 'a@b.com',
          phone_number: '+237600000001',
        })
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
      await expect(service.startLoginOtp({})).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('returns 404 without sending OTP when the user is missing', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });
      await expect(
        service.startLoginOtp({ email: ' Missing@Example.COM ' })
      ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
      expect(auth0Service.startEmailOtp).not.toHaveBeenCalled();
    });

    it('skips Auth0 for enabled test users', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ ...userWithBoth, email: 'qa@example.com', phone_number: null }],
      });
      auth0Service.isTestUsersEnabled.mockReturnValue(true);
      auth0Service.isTestEmail.mockReturnValue(true);

      await service.startLoginOtp({ email: 'qa@example.com' });
      expect(auth0Service.startEmailOtp).not.toHaveBeenCalled();
    });

    it('normalizes email and starts Auth0 OTP for a real user', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ ...userWithBoth, phone_number: null }],
      });
      const result = await service.startLoginOtp({
        email: ' Shop@Example.COM ',
      });
      expect(auth0Service.startEmailOtp).toHaveBeenCalledWith(
        'shop@example.com'
      );
      expect(result.channel).toBe('email');
      expect(result.availableChannels).toEqual(['email']);
    });

    it('sends OTP to the alternate channel when requested', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [userWithBoth],
      });
      const result = await service.startLoginOtp({
        phone_number: '+237670000000',
        channel: 'email',
      });
      expect(auth0Service.startEmailOtp).toHaveBeenCalledWith(
        'shop@example.com'
      );
      expect(auth0Service.startSmsOtp).not.toHaveBeenCalled();
      expect(result.channel).toBe('email');
      expect(result.availableChannels).toEqual(['email', 'sms']);
    });
  });

  describe('verifyLoginOtp', () => {
    it('rejects both identifiers, neither, or a blank OTP', async () => {
      await expect(
        service.verifyLoginOtp(
          { email: 'a@b.com', phone_number: '+2376', otp: '1234' },
          'mobile'
        )
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
      await expect(
        service.verifyLoginOtp({ otp: '1234' }, 'mobile')
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
      await expect(
        service.verifyLoginOtp({ email: 'a@b.com', otp: '  ' }, 'mobile')
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('returns 429 without verifying when the identifier is locked out', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [
          {
            id: 'user-1',
            email: 'shop@example.com',
            phone_number: null,
            email_verified: true,
            phone_number_verified: null,
          },
        ],
      });
      lockout.isLockedOut.mockResolvedValue(true);
      lockout.getRemainingLockoutMs.mockResolvedValue(90_000);

      await expect(
        service.verifyLoginOtp(
          { email: 'shop@example.com', otp: '1234' },
          'mobile'
        )
      ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
      expect(auth0Service.verifyEmailOtp).not.toHaveBeenCalled();
    });

    it('records a failure when Auth0 rejects the OTP', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [
          {
            id: 'user-1',
            email: 'shop@example.com',
            phone_number: null,
            email_verified: true,
            phone_number_verified: null,
          },
        ],
      });
      auth0Service.verifyEmailOtp.mockRejectedValue(
        Object.assign(new Error('bad otp'), { status: HttpStatus.BAD_REQUEST })
      );
      await expect(
        service.verifyLoginOtp(
          { email: 'shop@example.com', otp: '0000' },
          'mobile'
        )
      ).rejects.toBeTruthy();
      expect(lockout.recordFailure).toHaveBeenCalledWith('user:user-1');
      expect(lockout.recordFailure).toHaveBeenCalledWith('shop@example.com');
      expect(lockout.recordSuccess).not.toHaveBeenCalled();
    });

    it('creates a web session and omits the refresh token from the JSON body', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [
          {
            id: 'user-1',
            email: 'shop@example.com',
            phone_number: null,
            email_verified: true,
            phone_number_verified: null,
          },
        ],
      });

      const result = await service.verifyLoginOtp(
        { email: 'shop@example.com', otp: '1234' },
        'web',
        '1.1.1.1',
        'jest'
      );

      expect(result.sessionId).toBe('sid-new');
      expect(result.response).toMatchObject({
        success: true,
        access_token: 'access',
      });
      expect(result.response).not.toHaveProperty('refresh_token');
      expect(sessionStore.createSession).toHaveBeenCalledWith(
        'sid-new',
        expect.objectContaining({
          userId: 'user-1',
          auth0RefreshToken: 'refresh',
          ipAddress: '1.1.1.1',
        })
      );
      expect(lockout.recordSuccess).toHaveBeenCalledWith('user:user-1');
      expect(lockout.recordSuccess).toHaveBeenCalledWith('shop@example.com');
    });

    it('returns refresh_token to mobile clients without creating a cookie session', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [
          {
            id: 'user-1',
            email: 'shop@example.com',
            phone_number: null,
            email_verified: true,
            phone_number_verified: null,
          },
        ],
      });

      const result = await service.verifyLoginOtp(
        { email: 'shop@example.com', otp: '1234' },
        'mobile'
      );

      expect(result.sessionId).toBeUndefined();
      expect(result.response.refresh_token).toBe('refresh');
      expect(sessionStore.createSession).not.toHaveBeenCalled();
    });

    it('verifies OTP on the alternate channel when channel is provided', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [userWithBoth],
      });

      await service.verifyLoginOtp(
        {
          phone_number: '+237670000000',
          otp: '1234',
          channel: 'email',
        },
        'mobile'
      );

      expect(auth0Service.verifyEmailOtp).toHaveBeenCalledWith(
        'shop@example.com',
        '1234'
      );
      expect(auth0Service.verifySmsOtp).not.toHaveBeenCalled();
      expect(lockout.recordSuccess).toHaveBeenCalledWith('user:user-1');
      expect(lockout.recordSuccess).toHaveBeenCalledWith('shop@example.com');
      expect(lockout.recordSuccess).toHaveBeenCalledWith('+237670000000');
    });
  });

  describe('refreshSession', () => {
    it('returns 401 when the session cookie is unknown', async () => {
      sessionStore.getSession.mockResolvedValue(null);
      await expect(service.refreshSession('missing')).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
    });

    it('deletes the session when Auth0 refresh fails', async () => {
      sessionStore.getSession.mockResolvedValue({
        userId: 'user-1',
        auth0RefreshToken: 'refresh',
      });
      auth0Service.refreshAccessToken.mockRejectedValue(new Error('revoked'));

      await expect(service.refreshSession('sid-1')).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
      expect(sessionStore.deleteSession).toHaveBeenCalledWith('sid-1');
    });

    it('maps a failed rotation (replay) to 401 and deletes the session', async () => {
      sessionStore.getSession.mockResolvedValue({
        userId: 'user-1',
        auth0RefreshToken: 'refresh',
      });
      auth0Service.refreshAccessToken.mockResolvedValue({
        access_token: 'new-access',
        id_token: 'new-id',
        token_type: 'Bearer',
        expires_in: 3600,
      });
      sessionStore.rotateSession.mockResolvedValue(null);

      await expect(service.refreshSession('sid-1')).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
      expect(sessionStore.deleteSession).toHaveBeenCalledWith('sid-1');
    });
  });
});
