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
import { SignupService } from './signup.service';

describe('SignupService', () => {
  let service: SignupService;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let auth0Service: jest.Mocked<Auth0Service>;
  let addressesService: jest.Mocked<AddressesService>;
  let userProvisioning: jest.Mocked<UserProvisioningService>;
  let businessProvisioning: jest.Mocked<BusinessProvisioningService>;
  let referralProvisioning: jest.Mocked<ReferralProvisioningService>;
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
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
      expect(auth0Service.startSmsOtp).toHaveBeenCalledWith('+237600000001');
      expect(
        metaConversionsService.trackCompleteRegistrationSafe
      ).not.toHaveBeenCalled();
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
      expect(result.user.id).toBe('user-123');
      expect(result.tokens.access_token).toBe('token');

      const completeCall = hasuraSystemService.executeMutation.mock.calls.find(
        ([mutation]) => String(mutation).includes('CompleteSignupAttempt')
      );
      expect(completeCall?.[0]).toContain('status: "completed"');
      expect(completeCall?.[0]).toContain('email: null');
      expect(completeCall?.[0]).toContain('phone_number: null');
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

      expect(result.user.id).toBe('user-123');
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
      expect(result.user.id).toBe('user-123');
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
      expect(result.user.id).toBe('user-123');
      expect(result.tokens.access_token).toBe('token');
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
