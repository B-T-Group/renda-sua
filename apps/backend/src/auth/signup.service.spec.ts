import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../addresses/addresses.service', () => ({
  AddressesService: jest.fn(),
}));
jest.mock('./provisioning/business-provisioning.service', () => ({
  BusinessProvisioningService: jest.fn(),
}));
jest.mock('./provisioning/referral-provisioning.service', () => ({
  ReferralProvisioningService: jest.fn(),
}));
jest.mock('./provisioning/user-provisioning.service', () => ({
  UserProvisioningService: jest.fn(),
}));

import { AddressesService } from '../addresses/addresses.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { MetaConversionsService } from '../meta-conversions/meta-conversions.service';
import { Auth0Service } from './auth0.service';
import { BusinessProvisioningService } from './provisioning/business-provisioning.service';
import { ReferralProvisioningService } from './provisioning/referral-provisioning.service';
import { UserProvisioningService } from './provisioning/user-provisioning.service';
import { SessionStoreService } from './session-store.service';
import { SignupService } from './signup.service';

describe('SignupService', () => {
  let service: SignupService;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let auth0Service: jest.Mocked<Auth0Service>;
  let addressesService: jest.Mocked<AddressesService>;
  let userProvisioning: jest.Mocked<UserProvisioningService>;
  let businessProvisioning: jest.Mocked<BusinessProvisioningService>;
  let referralProvisioning: jest.Mocked<ReferralProvisioningService>;
  let sessionStore: jest.Mocked<SessionStoreService>;
  let metaConversionsService: { trackCompleteRegistrationSafe: jest.Mock };

  const insertedUser = {
    id: 'user-123',
    email: 'new@example.com',
    first_name: 'New',
    last_name: 'User',
    user_type_id: 'client',
    phone_number: '+237600000001',
    email_verified: true,
  };

  const pendingAttempt = {
    id: 'attempt-123',
    channel: 'email' as const,
    email: 'new@example.com',
    phone_number: '+237600000001',
    payload: {
      first_name: 'New',
      last_name: 'User',
      email: 'new@example.com',
      phone_number: '+237600000001',
      personas: ['client' as const],
      profile: {},
      country: 'CM',
    },
    status: 'pending' as const,
    verify_attempts: 0,
    last_otp_sent_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    completed_user_id: null,
    completion_result: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignupService,
        {
          provide: HasuraSystemService,
          useValue: {
            executeQuery: jest.fn().mockResolvedValue({ users: [] }),
            executeMutation: jest.fn(),
          },
        },
        {
          provide: Auth0Service,
          useValue: {
            startEmailOtp: jest.fn().mockResolvedValue(undefined),
            startSmsOtp: jest.fn().mockResolvedValue(undefined),
            verifyEmailOtp: jest.fn(),
            verifySmsOtp: jest.fn(),
            verifyTestUserEmail: jest.fn(),
            verifyTestUserPhone: jest.fn(),
            isTestUsersEnabled: jest.fn().mockReturnValue(false),
            isTestEmail: jest.fn().mockReturnValue(false),
            isTestPhone: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: SessionStoreService,
          useValue: {
            generateSessionId: jest.fn().mockReturnValue('sid-1'),
            createSession: jest.fn().mockResolvedValue(undefined),
            getSession: jest.fn(),
          },
        },
        {
          provide: AddressesService,
          useValue: {
            createAddressForSignup: jest.fn(),
          },
        },
        {
          provide: UserProvisioningService,
          useValue: {
            createPendingUser: jest.fn(),
          },
        },
        {
          provide: BusinessProvisioningService,
          useValue: {
            runPostCommitEffects: jest
              .fn()
              .mockResolvedValue({ launchPromo: null }),
            scheduleEnsureContract: jest.fn(),
            scheduleEnsureContractForUser: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
        {
          provide: ReferralProvisioningService,
          useValue: {
            resolveSignupReferral: jest.fn().mockResolvedValue(null),
            resolveBusinessReferral: jest.fn().mockResolvedValue(null),
            getBusinessInsertReferralFields: jest.fn().mockReturnValue({}),
            getAgentInsertReferralFields: jest.fn().mockReturnValue({}),
            clientInsertFields: jest.fn().mockReturnValue({}),
            referrerUserId: jest.fn().mockReturnValue(null),
            runPostCommitEffects: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: MetaConversionsService,
          useValue: {
            trackCompleteRegistrationSafe: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<SignupService>(SignupService);
    hasuraSystemService = module.get(HasuraSystemService);
    auth0Service = module.get(Auth0Service);
    addressesService = module.get(AddressesService);
    userProvisioning = module.get(UserProvisioningService);
    businessProvisioning = module.get(BusinessProvisioningService);
    referralProvisioning = module.get(ReferralProvisioningService);
    sessionStore = module.get(SessionStoreService);
    metaConversionsService = module.get(MetaConversionsService);
  });

  describe('availability checks', () => {
    it('normalizes email before checking if it is taken', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ id: 'u1' }],
      });

      const taken = await service.isEmailTaken('  Taken@Example.COM  ');

      expect(taken).toBe(true);
      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('ContactTaken'),
        { value: 'taken@example.com' }
      );
    });

    it('treats any existing holder as taken, including unverified rows', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ id: 'pending-or-active' }],
      });
      await expect(service.isEmailTaken('pending@example.com')).resolves.toBe(
        true
      );
    });
  });

  describe('startSignup', () => {
    const basePayload = {
      first_name: 'New',
      last_name: 'User',
      personas: ['client' as const],
      profile: {},
    };

    it('requires either an email or phone number', async () => {
      await expect(service.startSignup(basePayload)).rejects.toThrow(
        new HttpException(
          { success: false, error: 'Email or phone number is required' },
          HttpStatus.BAD_REQUEST
        )
      );
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
    });

    it('rejects a taken phone before creating an attempt', async () => {
      hasuraSystemService.executeQuery.mockResolvedValueOnce({
        users: [{ id: 'u1' }],
      });

      await expect(
        service.startSignup({
          ...basePayload,
          phone_number: ' +237600000001 ',
        })
      ).rejects.toThrow(
        new HttpException(
          { success: false, error: 'Phone number is already taken' },
          HttpStatus.CONFLICT
        )
      );
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
    });

    it('creates a signup attempt and sends OTP without provisioning a user', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });
      hasuraSystemService.executeMutation.mockImplementation(
        async (mutation: string, variables?: Record<string, unknown>) => {
          if (mutation.includes('CleanupExpiredSignupAttempts')) {
            return { update_signup_attempts: { affected_rows: 0 } };
          }
          if (mutation.includes('InsertSignupAttempt')) {
            return {
              insert_signup_attempts_one: {
                ...pendingAttempt,
                channel: variables?.channel || 'email',
                email: variables?.email ?? pendingAttempt.email,
                phone_number:
                  variables?.phone_number ?? pendingAttempt.phone_number,
              },
            };
          }
          return {};
        }
      );

      const result = await service.startSignup({
        ...basePayload,
        email: ' New@Example.COM ',
        phone_number: '+237600000001',
        country: 'CM',
      });

      expect(result.attemptId).toBe('attempt-123');
      expect(result.channel).toBe('sms');
      expect(result.availableChannels).toEqual(['email', 'sms']);
      expect(result.maskedEmail).toBe('ne***@example.com');
      expect(result.maskedPhone).toBe('••••••0001');
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
      expect(auth0Service.startSmsOtp).toHaveBeenCalledWith('+237600000001');
      expect(
        metaConversionsService.trackCompleteRegistrationSafe
      ).not.toHaveBeenCalled();
    });

    it('honors verification_channel email in an SMS-default market', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });
      hasuraSystemService.executeMutation.mockImplementation(
        async (mutation: string, variables?: Record<string, unknown>) => {
          if (mutation.includes('CleanupExpiredSignupAttempts')) {
            return { update_signup_attempts: { affected_rows: 0 } };
          }
          if (mutation.includes('InsertSignupAttempt')) {
            return {
              insert_signup_attempts_one: {
                ...pendingAttempt,
                channel: variables?.channel || 'email',
                email: variables?.email ?? pendingAttempt.email,
                phone_number:
                  variables?.phone_number ?? pendingAttempt.phone_number,
              },
            };
          }
          return {};
        }
      );

      const result = await service.startSignup({
        ...basePayload,
        email: ' New@Example.COM ',
        phone_number: '+237600000001',
        country: 'CM',
        verification_channel: 'email',
      });

      expect(result.channel).toBe('email');
      expect(auth0Service.startEmailOtp).toHaveBeenCalledWith(
        'new@example.com'
      );
      expect(auth0Service.startSmsOtp).not.toHaveBeenCalled();
    });

    it('expires prior open attempts by email/phone, never contact_value', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });
      hasuraSystemService.executeMutation.mockImplementation(
        async (mutation: string, variables?: Record<string, unknown>) => {
          if (mutation.includes('CleanupExpiredSignupAttempts')) {
            return { update_signup_attempts: { affected_rows: 0 } };
          }
          if (mutation.includes('SupersedeSignupAttempts')) {
            return { update_signup_attempts: { affected_rows: 1 } };
          }
          if (mutation.includes('InsertSignupAttempt')) {
            return {
              insert_signup_attempts_one: {
                ...pendingAttempt,
                channel: variables?.channel || 'email',
                email: variables?.email ?? pendingAttempt.email,
                phone_number:
                  variables?.phone_number ?? pendingAttempt.phone_number,
              },
            };
          }
          return {};
        }
      );

      await service.startSignup({
        ...basePayload,
        email: ' New@Example.COM ',
        phone_number: ' +237600000001 ',
        country: 'CM',
      });

      const supersedeCall = hasuraSystemService.executeMutation.mock.calls.find(
        ([mutation]) => String(mutation).includes('SupersedeSignupAttempts')
      );
      const insertCall = hasuraSystemService.executeMutation.mock.calls.find(
        ([mutation]) => String(mutation).includes('InsertSignupAttempt')
      );

      expect(supersedeCall).toBeDefined();
      expect(String(supersedeCall?.[0])).not.toContain('contact_value');
      expect(String(insertCall?.[0])).not.toContain('contact_value');
      expect(supersedeCall?.[1]).toEqual(
        expect.objectContaining({
          where: {
            status: { _in: ['pending', 'otp_verified'] },
            _or: [
              { email: { _eq: 'new@example.com' } },
              { phone_number: { _eq: '+237600000001' } },
            ],
          },
        })
      );
    });

    it('rejects store_location without country', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });

      await expect(
        service.startSignup({
          first_name: 'Biz',
          last_name: 'Owner',
          email: 'biz@example.com',
          personas: ['business'],
          profile: { name: 'Acme' },
          store_location: {
            street: '1 Main',
            city: 'Montreal',
            region: 'Quebec',
          },
        })
      ).rejects.toThrow(
        new HttpException(
          {
            success: false,
            error: 'country is required when store_location is provided',
          },
          HttpStatus.BAD_REQUEST
        )
      );
    });
  });

  describe('resendSignupOtp', () => {
    it('enforces cooldown for same-channel resend', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        signup_attempts_by_pk: {
          ...pendingAttempt,
          last_otp_sent_at: new Date().toISOString(),
        },
      });

      await expect(service.resendSignupOtp('attempt-123')).rejects.toMatchObject(
        { status: HttpStatus.TOO_MANY_REQUESTS }
      );
      expect(auth0Service.startEmailOtp).not.toHaveBeenCalled();
    });

    it('switches channel without cooldown and updates the attempt', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        signup_attempts_by_pk: {
          ...pendingAttempt,
          channel: 'sms',
          last_otp_sent_at: new Date().toISOString(),
        },
      });
      hasuraSystemService.executeMutation.mockImplementation(
        async (mutation: string, variables?: Record<string, unknown>) => {
          if (mutation.includes('UpdateSignupAttemptChannel')) {
            return {
              update_signup_attempts_by_pk: {
                ...pendingAttempt,
                channel: variables?.channel || 'email',
                last_otp_sent_at: pendingAttempt.last_otp_sent_at,
              },
            };
          }
          if (mutation.includes('TouchSignupOtp')) {
            return {
              update_signup_attempts_by_pk: {
                ...pendingAttempt,
                channel: 'email',
                last_otp_sent_at: new Date().toISOString(),
              },
            };
          }
          return {};
        }
      );

      const result = await service.resendSignupOtp('attempt-123', 'email');
      expect(auth0Service.startEmailOtp).toHaveBeenCalledWith(
        'new@example.com'
      );
      expect(auth0Service.startSmsOtp).not.toHaveBeenCalled();
      expect(result.channel).toBe('email');
      expect(result.availableChannels).toEqual(['email', 'sms']);
    });

    it('reverts attempt channel when switch send fails', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        signup_attempts_by_pk: {
          ...pendingAttempt,
          channel: 'sms',
          last_otp_sent_at: new Date().toISOString(),
        },
      });
      hasuraSystemService.executeMutation.mockImplementation(
        async (mutation: string, variables?: Record<string, unknown>) => {
          if (mutation.includes('UpdateSignupAttemptChannel')) {
            return {
              update_signup_attempts_by_pk: {
                ...pendingAttempt,
                channel: variables?.channel || 'email',
              },
            };
          }
          return {};
        }
      );
      auth0Service.startEmailOtp.mockRejectedValue(new Error('Auth0 down'));

      await expect(
        service.resendSignupOtp('attempt-123', 'email')
      ).rejects.toThrow('Auth0 down');

      const channelUpdates = hasuraSystemService.executeMutation.mock.calls
        .filter(([mutation]) =>
          String(mutation).includes('UpdateSignupAttemptChannel')
        )
        .map(([, variables]) => variables);
      expect(channelUpdates).toEqual([
        expect.objectContaining({ channel: 'email' }),
        expect.objectContaining({ channel: 'sms' }),
      ]);
    });

    it('rejects channel switch when the attempt has no phone for SMS', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        signup_attempts_by_pk: {
          ...pendingAttempt,
          phone_number: null,
          channel: 'email',
        },
      });

      await expect(
        service.resendSignupOtp('attempt-123', 'sms')
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: {
          error: 'No phone number on this signup attempt for SMS OTP',
        },
      });
      expect(auth0Service.startSmsOtp).not.toHaveBeenCalled();
    });
  });

  describe('verifySignupOtp', () => {
    const auth0Token = {
      access_token: 'token',
      id_token:
        'eyJhbGciOiJub25lIn0.' +
        Buffer.from(
          JSON.stringify({
            sub: 'email|abc',
            email: 'new@example.com',
          })
        ).toString('base64url') +
        '.',
      token_type: 'Bearer',
      expires_in: 3600,
    };

    it('provisions the durable account only after OTP verification', async () => {
      auth0Service.verifyEmailOtp.mockResolvedValue(auth0Token);
      userProvisioning.createPendingUser.mockResolvedValue({
        user: insertedUser,
        entities: [{ id: 'client-123', type: 'client' }],
      });

      const emailAttempt = {
        ...pendingAttempt,
        channel: 'email' as const,
        payload: {
          ...pendingAttempt.payload,
          country: 'CA',
        },
      };
      hasuraSystemService.executeQuery.mockReset();
      hasuraSystemService.executeQuery
        .mockResolvedValueOnce({ signup_attempts_by_pk: emailAttempt })
        .mockResolvedValue({ users: [] });
      hasuraSystemService.executeMutation.mockImplementation(
        async (mutation: string) => {
          if (mutation.includes('ClaimSignupAttempt')) {
            return { update_signup_attempts: { affected_rows: 1 } };
          }
          return { update_signup_attempts_by_pk: { id: 'attempt-123' } };
        }
      );

      const result = await service.verifySignupOtp({
        attemptId: 'attempt-123',
        otp: '123456',
      });

      expect(auth0Service.verifyEmailOtp).toHaveBeenCalledWith(
        'new@example.com',
        '123456'
      );
      expect(userProvisioning.createPendingUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          email_verified: true,
          personas: ['client'],
        })
      );
      expect(businessProvisioning.runPostCommitEffects).toHaveBeenCalled();
      expect(referralProvisioning.runPostCommitEffects).toHaveBeenCalled();
      expect(
        businessProvisioning.scheduleEnsureContractForUser
      ).toHaveBeenCalledWith('user-123');
      expect(
        metaConversionsService.trackCompleteRegistrationSafe
      ).toHaveBeenCalled();
      expect(result.response.user.id).toBe('user-123');
      expect(result.response.access_token).toBe('token');
    });

    it('creates a web session on first signup verify and omits refresh_token from JSON', async () => {
      const webToken = { ...auth0Token, refresh_token: 'refresh-1' };
      auth0Service.verifyEmailOtp.mockResolvedValue(webToken);
      (auth0Service as any).setRendasuaUserMetadata = jest.fn().mockResolvedValue(undefined);
      (auth0Service as any).refreshTokensForNewUser = jest.fn().mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh-1',
      });
      userProvisioning.createPendingUser.mockResolvedValue({
        user: insertedUser,
        entities: [{ id: 'client-123', type: 'client' }],
      });

      const emailAttempt = {
        ...pendingAttempt,
        channel: 'email' as const,
        payload: {
          ...pendingAttempt.payload,
          country: 'CA',
        },
      };
      hasuraSystemService.executeQuery.mockReset();
      hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('signup_attempts_by_pk') || query.includes('SignupAttempt')) {
          return { signup_attempts_by_pk: emailAttempt };
        }
        return { users: [] };
      });
      hasuraSystemService.executeMutation.mockImplementation(
        async (mutation: string) => {
          if (mutation.includes('ClaimSignupAttempt')) {
            return { update_signup_attempts: { affected_rows: 1 } };
          }
          return { update_signup_attempts_by_pk: { id: 'attempt-123' } };
        }
      );

      const result = await service.verifySignupOtp(
        { attemptId: 'attempt-123', otp: '123456' },
        'web',
        '9.9.9.9',
        'jest'
      );

      expect(sessionStore.generateSessionId).toHaveBeenCalled();
      expect(sessionStore.createSession).toHaveBeenCalledWith(
        'sid-1',
        expect.objectContaining({
          userId: 'user-123',
          auth0RefreshToken: 'refresh-1',
          ipAddress: '9.9.9.9',
          userAgent: 'jest',
        })
      );
      expect(result.sessionId).toBe('sid-1');
      expect(result.response.refresh_token).toBeUndefined();
      expect(result.response.access_token).toBe('token');
    });

    it('verifies SMS OTP and marks the phone verified', async () => {
      const smsToken = {
        ...auth0Token,
        id_token:
          'eyJhbGciOiJub25lIn0.' +
          Buffer.from(
            JSON.stringify({
              sub: 'sms|abc',
              phone_number: '+237600000001',
            })
          ).toString('base64url') +
          '.',
      };
      auth0Service.verifySmsOtp.mockResolvedValue(smsToken);
      userProvisioning.createPendingUser.mockResolvedValue({
        user: { ...insertedUser, email_verified: false },
        entities: [{ id: 'client-123', type: 'client' }],
      });

      const smsAttempt = {
        ...pendingAttempt,
        channel: 'sms' as const,
      };
      hasuraSystemService.executeQuery.mockReset();
      hasuraSystemService.executeQuery
        .mockResolvedValueOnce({ signup_attempts_by_pk: smsAttempt })
        .mockResolvedValue({ users: [] });
      hasuraSystemService.executeMutation.mockImplementation(
        async (mutation: string) => {
          if (mutation.includes('ClaimSignupAttempt')) {
            return { update_signup_attempts: { affected_rows: 1 } };
          }
          return { update_signup_attempts_by_pk: { id: 'attempt-123' } };
        }
      );

      const result = await service.verifySignupOtp(
        { attemptId: 'attempt-123', otp: '123456' },
        'mobile'
      );

      expect(auth0Service.verifySmsOtp).toHaveBeenCalledWith(
        '+237600000001',
        '123456'
      );
      expect(auth0Service.verifyEmailOtp).not.toHaveBeenCalled();
      expect(userProvisioning.createPendingUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          phone_number: '+237600000001',
          email_verified: false,
        })
      );
      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('MarkSignupPhoneVerified'),
        expect.objectContaining({ id: 'user-123' })
      );
      expect(result.response.user.id).toBe('user-123');
      expect(result.response.access_token).toBe('token');
    });

    it('rejects SMS verify when Auth0 phone does not match the attempt', async () => {
      const mismatchedToken = {
        ...auth0Token,
        id_token:
          'eyJhbGciOiJub25lIn0.' +
          Buffer.from(
            JSON.stringify({
              sub: 'sms|abc',
              phone_number: '+237699999999',
            })
          ).toString('base64url') +
          '.',
      };
      auth0Service.verifySmsOtp.mockResolvedValue(mismatchedToken);
      hasuraSystemService.executeQuery.mockResolvedValue({
        signup_attempts_by_pk: {
          ...pendingAttempt,
          channel: 'sms' as const,
        },
      });

      await expect(
        service.verifySignupOtp(
          { attemptId: 'attempt-123', otp: '123456' },
          'mobile'
        )
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { error: 'Verified identity does not match signup' },
      });
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
    });

    it('increments verify attempts when Auth0 SMS verify fails', async () => {
      auth0Service.verifySmsOtp.mockRejectedValue(
        new HttpException(
          { success: false, error: 'Invalid OTP' },
          HttpStatus.BAD_REQUEST
        )
      );
      hasuraSystemService.executeQuery.mockResolvedValue({
        signup_attempts_by_pk: {
          ...pendingAttempt,
          channel: 'sms' as const,
        },
      });

      await expect(
        service.verifySignupOtp(
          { attemptId: 'attempt-123', otp: '000000' },
          'mobile'
        )
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('IncSignupVerifyAttempts'),
        expect.objectContaining({ id: 'attempt-123', n: 1 })
      );
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
    });

    it('rejects expired attempts without creating a user', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        signup_attempts_by_pk: {
          ...pendingAttempt,
          expires_at: new Date(Date.now() - 1000).toISOString(),
        },
      });

      await expect(
        service.verifySignupOtp({ attemptId: 'attempt-123', otp: '123456' })
      ).rejects.toThrow(HttpException);
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
      expect(auth0Service.verifyEmailOtp).not.toHaveBeenCalled();
    });

    it('replays a recent completed attempt without double-provisioning', async () => {
      const snapshot = {
        user: insertedUser,
        launchPromo: null,
        tokens: auth0Token,
        completedAt: new Date().toISOString(),
      };
      hasuraSystemService.executeQuery.mockResolvedValue({
        signup_attempts_by_pk: {
          ...pendingAttempt,
          status: 'completed',
          completed_user_id: 'user-123',
          completion_result: snapshot,
        },
      });

      const result = await service.verifySignupOtp({
        attemptId: 'attempt-123',
        otp: '000000',
      });

      expect(result.response.user.id).toBe('user-123');
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
      expect(auth0Service.verifyEmailOtp).not.toHaveBeenCalled();
    });

    it('allows provisioning retry after OTP TTL when already verified', async () => {
      const verifiedAttempt = {
        ...pendingAttempt,
        status: 'otp_verified' as const,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
        completion_result: {
          user: insertedUser,
          launchPromo: null,
          tokens: auth0Token,
          completedAt: new Date().toISOString(),
        },
      };
      hasuraSystemService.executeQuery.mockReset();
      hasuraSystemService.executeQuery
        .mockResolvedValueOnce({ signup_attempts_by_pk: verifiedAttempt })
        .mockResolvedValue({ users: [] });
      userProvisioning.createPendingUser.mockResolvedValue({
        user: insertedUser,
        entities: [{ id: 'client-123', type: 'client' }],
      });
      hasuraSystemService.executeMutation.mockImplementation(
        async (mutation: string) => {
          if (mutation.includes('ClaimSignupAttempt')) {
            return { update_signup_attempts: { affected_rows: 1 } };
          }
          return { update_signup_attempts_by_pk: { id: 'attempt-123' } };
        }
      );

      const result = await service.verifySignupOtp({
        attemptId: 'attempt-123',
        otp: '000000',
      });

      expect(auth0Service.verifyEmailOtp).not.toHaveBeenCalled();
      expect(userProvisioning.createPendingUser).toHaveBeenCalled();
      expect(result.response.user.id).toBe('user-123');
    });

    it('resumes completion when the durable user already exists', async () => {
      const verifiedAttempt = {
        ...pendingAttempt,
        status: 'otp_verified' as const,
        completion_result: {
          user: insertedUser,
          launchPromo: null,
          tokens: auth0Token,
          completedAt: new Date().toISOString(),
        },
      };
      hasuraSystemService.executeQuery.mockReset();
      hasuraSystemService.executeQuery
        .mockResolvedValueOnce({ signup_attempts_by_pk: verifiedAttempt })
        .mockResolvedValueOnce({ users: [insertedUser] })
        .mockResolvedValueOnce({
          users_by_pk: {
            ...insertedUser,
            client: { id: 'client-123' },
            agent: null,
            business: null,
          },
        });
      hasuraSystemService.executeMutation.mockImplementation(
        async (mutation: string) => {
          if (mutation.includes('ClaimSignupAttempt')) {
            return { update_signup_attempts: { affected_rows: 1 } };
          }
          return { update_signup_attempts_by_pk: { id: 'attempt-123' } };
        }
      );

      const result = await service.verifySignupOtp({
        attemptId: 'attempt-123',
        otp: '000000',
      });

      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
      expect(businessProvisioning.runPostCommitEffects).toHaveBeenCalled();
      expect(referralProvisioning.runPostCommitEffects).toHaveBeenCalled();
      expect(result.response.user.id).toBe('user-123');
      expect(result.response.access_token).toBe('token');
    });

    it('rejects verify when Auth0 id_token email does not match the attempt', async () => {
      const mismatchedToken = {
        ...auth0Token,
        id_token:
          'eyJhbGciOiJub25lIn0.' +
          Buffer.from(
            JSON.stringify({
              sub: 'email|abc',
              email: 'other@example.com',
            })
          ).toString('base64url') +
          '.',
      };
      auth0Service.verifyEmailOtp.mockResolvedValue(mismatchedToken);
      hasuraSystemService.executeQuery.mockResolvedValue({
        signup_attempts_by_pk: pendingAttempt,
      });

      await expect(
        service.verifySignupOtp({ attemptId: 'attempt-123', otp: '123456' })
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { error: 'Verified identity does not match signup' },
      });
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
    });

    it('blocks verify after max attempts and marks the attempt failed', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        signup_attempts_by_pk: {
          ...pendingAttempt,
          verify_attempts: 5,
        },
      });

      await expect(
        service.verifySignupOtp({ attemptId: 'attempt-123', otp: '1234' })
      ).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
        response: {
          error: 'Too many invalid codes. Please start signup again.',
        },
      });
      expect(auth0Service.verifyEmailOtp).not.toHaveBeenCalled();
      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('FailSignupAttempt'),
        expect.objectContaining({ id: 'attempt-123' })
      );
    });

    it('returns GONE on web replay when stored sessionId is missing', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        signup_attempts_by_pk: {
          ...pendingAttempt,
          status: 'completed',
          completed_user_id: 'user-123',
          completion_result: {
            user: insertedUser,
            launchPromo: null,
            tokens: auth0Token,
            completedAt: new Date().toISOString(),
          },
        },
      });

      await expect(
        service.verifySignupOtp(
          { attemptId: 'attempt-123', otp: '000000' },
          'web'
        )
      ).rejects.toMatchObject({
        status: HttpStatus.GONE,
        response: {
          error: 'Signup session expired. Please log in to continue.',
        },
      });
      expect(sessionStore.createSession).not.toHaveBeenCalled();
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
    });

    it('reuses the stored web session on replay instead of minting another', async () => {
      sessionStore.getSession.mockResolvedValue({
        userId: 'user-123',
        auth0RefreshToken: 'refresh',
      });
      hasuraSystemService.executeQuery.mockResolvedValue({
        signup_attempts_by_pk: {
          ...pendingAttempt,
          status: 'completed',
          completed_user_id: 'user-123',
          completion_result: {
            user: insertedUser,
            launchPromo: null,
            tokens: auth0Token,
            sessionId: 'sid-stored',
            completedAt: new Date().toISOString(),
          },
        },
      });

      const result = await service.verifySignupOtp(
        { attemptId: 'attempt-123', otp: '000000' },
        'web'
      );

      expect(result.sessionId).toBe('sid-stored');
      expect(sessionStore.getSession).toHaveBeenCalledWith('sid-stored');
      expect(sessionStore.createSession).not.toHaveBeenCalled();
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
      expect(result.response.refresh_token).toBeUndefined();
    });
  });

  describe('purgeExpiredAttempts', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('expires pending attempts past expires_at and clears PII', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-09-05T10:00:00.000Z'));
      hasuraSystemService.executeMutation.mockResolvedValue({
        update_signup_attempts: { affected_rows: 3 },
      });

      const removed = await service.purgeExpiredAttempts();

      expect(removed).toBe(3);
      const cleanupCall = hasuraSystemService.executeMutation.mock.calls.find(
        ([mutation]) => String(mutation).includes('CleanupExpiredSignupAttempts')
      );
      expect(cleanupCall).toBeDefined();
      expect(String(cleanupCall?.[0])).toContain('status: { _eq: "pending" }');
      expect(String(cleanupCall?.[0])).toContain('expires_at: { _lt: $now }');
      expect(String(cleanupCall?.[0])).toContain('email: null');
      expect(String(cleanupCall?.[0])).toContain('phone_number: null');
      expect(String(cleanupCall?.[0])).toContain('payload: {}');
      expect(cleanupCall?.[1]).toEqual({ now: '2026-09-05T10:00:00.000Z' });
    });

    it('returns 0 when Hasura cleanup fails', async () => {
      hasuraSystemService.executeMutation.mockRejectedValue(
        new Error('Hasura 503')
      );

      await expect(service.purgeExpiredAttempts()).resolves.toBe(0);
    });
  });

  describe('deprecated endpoints', () => {
    it('returns gone for updateContact', async () => {
      await expect(service.updateContact()).rejects.toThrow(
        new HttpException(
          {
            success: false,
            error:
              'Contact updates for pending signups are no longer supported. Restart signup with corrected details.',
          },
          HttpStatus.GONE
        )
      );
    });

    it('returns gone for completeSignup', async () => {
      await expect(service.completeSignup()).rejects.toThrow(
        new HttpException(
          {
            success: false,
            error: 'Use /auth/signup/verify-otp to complete signup',
          },
          HttpStatus.GONE
        )
      );
    });
  });
});
