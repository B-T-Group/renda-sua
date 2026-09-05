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
import { SignupAttemptStore } from './signup-attempt.store';
import { SignupService } from './signup.service';
import type { SignupAttemptRow } from './signup-attempt.types';

describe('SignupService (deferred OTP)', () => {
  let service: SignupService;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let auth0Service: jest.Mocked<Auth0Service>;
  let addressesService: jest.Mocked<AddressesService>;
  let userProvisioning: jest.Mocked<UserProvisioningService>;
  let businessProvisioning: jest.Mocked<BusinessProvisioningService>;
  let referralProvisioning: jest.Mocked<ReferralProvisioningService>;
  let attemptStore: jest.Mocked<SignupAttemptStore>;
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

  const baseAttempt = (
    overrides: Partial<SignupAttemptRow> = {}
  ): SignupAttemptRow => ({
    id: 'attempt-1',
    channel: 'email',
    contact_value: 'new@example.com',
    payload: {
      first_name: 'New',
      last_name: 'User',
      email: 'new@example.com',
      phone_number: null,
      personas: ['client'],
      profile: {},
    },
    status: 'pending',
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    last_otp_sent_at: new Date().toISOString(),
    verify_attempt_count: 0,
    auth0_verified_at: null,
    completed_user_id: null,
    completion_result: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

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
          useValue: { createAddressForSignup: jest.fn() },
        },
        {
          provide: UserProvisioningService,
          useValue: { createPendingUser: jest.fn() },
        },
        {
          provide: BusinessProvisioningService,
          useValue: {
            runPostCommitEffects: jest
              .fn()
              .mockResolvedValue({ launchPromo: null }),
            scheduleEnsureContractForUser: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ReferralProvisioningService,
          useValue: {
            resolveSignupReferral: jest.fn().mockResolvedValue(null),
            getBusinessInsertReferralFields: jest.fn().mockReturnValue({}),
            getAgentInsertReferralFields: jest.fn().mockReturnValue({}),
            runPostCommitEffects: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: MetaConversionsService,
          useValue: {
            trackCompleteRegistrationSafe: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SignupAttemptStore,
          useValue: {
            insertPending: jest.fn(),
            findById: jest.fn(),
            supersedePendingForContact: jest.fn(),
            markOtpSent: jest.fn(),
            bumpVerifyCount: jest.fn().mockResolvedValue(1),
            updateStatus: jest.fn(),
            claimForVerify: jest.fn(),
            purgeExpired: jest.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();

    service = module.get(SignupService);
    hasuraSystemService = module.get(HasuraSystemService);
    auth0Service = module.get(Auth0Service);
    addressesService = module.get(AddressesService);
    userProvisioning = module.get(UserProvisioningService);
    businessProvisioning = module.get(BusinessProvisioningService);
    referralProvisioning = module.get(ReferralProvisioningService);
    attemptStore = module.get(SignupAttemptStore);
    metaConversionsService = module.get(MetaConversionsService);
  });

  describe('availability checks', () => {
    it('treats any existing holder as taken', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ id: 'pending-or-active' }],
      });
      await expect(service.isEmailTaken('pending@example.com')).resolves.toBe(
        true
      );
    });
  });

  describe('startSignup', () => {
    it('creates an attempt and sends OTP without provisioning a user', async () => {
      const attempt = baseAttempt();
      attemptStore.insertPending.mockResolvedValue(attempt);

      const result = await service.startSignup({
        first_name: 'New',
        last_name: 'User',
        email: ' New@Example.COM ',
        personas: ['client'],
        profile: {},
      });

      expect(result.attemptId).toBe('attempt-1');
      expect(result.channel).toBe('email');
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
      expect(auth0Service.startEmailOtp).toHaveBeenCalledWith('new@example.com');
      expect(
        metaConversionsService.trackCompleteRegistrationSafe
      ).not.toHaveBeenCalled();
    });

    it('rejects a taken email before creating an attempt', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ id: 'existing' }],
      });
      await expect(
        service.startSignup({
          first_name: 'New',
          last_name: 'User',
          email: 'taken@example.com',
          personas: ['client'],
          profile: {},
        })
      ).rejects.toThrow(HttpException);
      expect(attemptStore.insertPending).not.toHaveBeenCalled();
    });

    it('uses SMS channel for African markets with phone', async () => {
      const attempt = baseAttempt({
        channel: 'phone',
        contact_value: '+237600000001',
        payload: {
          first_name: 'New',
          last_name: 'User',
          email: null,
          phone_number: '+237600000001',
          personas: ['client'],
          profile: {},
          country: 'CM',
        },
      });
      attemptStore.insertPending.mockResolvedValue(attempt);

      await service.startSignup({
        first_name: 'New',
        last_name: 'User',
        phone_number: '+237600000001',
        personas: ['client'],
        profile: {},
        country: 'CM',
      });

      expect(attemptStore.insertPending).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'phone',
          contactValue: '+237600000001',
        })
      );
      expect(auth0Service.startSmsOtp).toHaveBeenCalledWith('+237600000001');
    });

    it('marks the attempt failed when OTP send fails after insert', async () => {
      const attempt = baseAttempt();
      attemptStore.insertPending.mockResolvedValue(attempt);
      auth0Service.startEmailOtp.mockRejectedValue(new Error('smtp down'));

      await expect(
        service.startSignup({
          first_name: 'New',
          last_name: 'User',
          email: 'new@example.com',
          personas: ['client'],
          profile: {},
        })
      ).rejects.toThrow('smtp down');

      expect(attemptStore.updateStatus).toHaveBeenCalledWith(
        'attempt-1',
        'failed'
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
            sub: 'email|1',
            email: 'new@example.com',
          })
        ).toString('base64url') +
        '.',
      token_type: 'Bearer',
      expires_in: 3600,
    };

    it('returns stored completion when attempt already completed', async () => {
      const completion = {
        tokens: auth0Token,
        user: insertedUser,
        launchPromo: null,
      };
      attemptStore.findById.mockResolvedValue(
        baseAttempt({
          status: 'completed',
          completion_result: completion,
        })
      );

      await expect(
        service.verifySignupOtp({ attemptId: 'attempt-1', otp: '123456' })
      ).resolves.toEqual(completion);
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
    });

    it('provisions the user only after OTP verification', async () => {
      const pending = baseAttempt();
      attemptStore.findById.mockResolvedValue(pending);
      attemptStore.claimForVerify.mockResolvedValue(pending);
      auth0Service.verifyEmailOtp.mockResolvedValue(auth0Token);
      userProvisioning.createPendingUser.mockResolvedValue({
        user: insertedUser,
        entities: [{ id: 'client-1', type: 'client' }],
      });
      attemptStore.updateStatus.mockResolvedValue(
        baseAttempt({ status: 'completed' })
      );

      const result = await service.verifySignupOtp({
        attemptId: 'attempt-1',
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
          phone_number_verified: false,
        })
      );
      expect(businessProvisioning.runPostCommitEffects).toHaveBeenCalled();
      expect(
        metaConversionsService.trackCompleteRegistrationSafe
      ).toHaveBeenCalled();
      expect(result.user.id).toBe('user-123');
      expect(result.tokens.access_token).toBe('token');
    });

    it('does not provision when OTP verification fails', async () => {
      const pending = baseAttempt();
      attemptStore.findById.mockResolvedValue(pending);
      attemptStore.claimForVerify.mockResolvedValue(pending);
      auth0Service.verifyEmailOtp.mockRejectedValue(new Error('bad otp'));

      await expect(
        service.verifySignupOtp({ attemptId: 'attempt-1', otp: '000000' })
      ).rejects.toThrow('bad otp');
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
    });

    it('rejects expired attempts without creating a user', async () => {
      attemptStore.findById.mockResolvedValue(
        baseAttempt({
          expires_at: new Date(Date.now() - 1000).toISOString(),
        })
      );

      await expect(
        service.verifySignupOtp({ attemptId: 'attempt-1', otp: '123456' })
      ).rejects.toThrow(
        new HttpException(
          { success: false, error: 'Signup attempt expired' },
          HttpStatus.GONE
        )
      );
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
    });

    it('retries provisioning without re-exchanging OTP after Auth0 success', async () => {
      const tokens = auth0Token;
      const pending = baseAttempt({
        status: 'verified_pending_provision',
        auth0_verified_at: new Date().toISOString(),
        completion_result: { tokens } as any,
      });
      attemptStore.findById.mockResolvedValue(pending);
      attemptStore.claimForVerify.mockResolvedValue(pending);
      userProvisioning.createPendingUser.mockResolvedValue({
        user: insertedUser,
        entities: [{ id: 'client-1', type: 'client' }],
      });
      attemptStore.updateStatus.mockResolvedValue(
        baseAttempt({ status: 'completed' })
      );

      const result = await service.verifySignupOtp({
        attemptId: 'attempt-1',
        otp: '123456',
      });

      expect(auth0Service.verifyEmailOtp).not.toHaveBeenCalled();
      expect(attemptStore.bumpVerifyCount).not.toHaveBeenCalled();
      expect(userProvisioning.createPendingUser).toHaveBeenCalled();
      expect(result.tokens.access_token).toBe('token');
    });

    it('returns conflict when another verify claim is in flight', async () => {
      const pending = baseAttempt();
      attemptStore.findById
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(pending);
      attemptStore.claimForVerify.mockResolvedValue(null);

      await expect(
        service.verifySignupOtp({ attemptId: 'attempt-1', otp: '123456' })
      ).rejects.toMatchObject({ status: 409 });
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
    });

    it('releases the verify claim back to pending when OTP exchange fails', async () => {
      const pending = baseAttempt();
      attemptStore.findById.mockResolvedValue(pending);
      attemptStore.claimForVerify.mockResolvedValue(pending);
      auth0Service.verifyEmailOtp.mockRejectedValue(new Error('bad otp'));

      await expect(
        service.verifySignupOtp({ attemptId: 'attempt-1', otp: '000000' })
      ).rejects.toThrow('bad otp');

      expect(attemptStore.updateStatus).toHaveBeenCalledWith(
        'attempt-1',
        'pending'
      );
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
    });

    it('persists Auth0 tokens when provisioning fails so retry can resume', async () => {
      const pending = baseAttempt();
      attemptStore.findById.mockResolvedValue(pending);
      attemptStore.claimForVerify.mockResolvedValue(pending);
      auth0Service.verifyEmailOtp.mockResolvedValue(auth0Token);
      userProvisioning.createPendingUser.mockRejectedValue(
        new Error('provision blew up')
      );

      await expect(
        service.verifySignupOtp({ attemptId: 'attempt-1', otp: '123456' })
      ).rejects.toThrow('provision blew up');

      expect(attemptStore.updateStatus).toHaveBeenCalledWith(
        'attempt-1',
        'verifying',
        expect.objectContaining({
          auth0VerifiedAt: expect.any(String),
          completionResult: expect.objectContaining({
            tokens: auth0Token,
          }),
        })
      );
      expect(attemptStore.updateStatus).toHaveBeenCalledWith(
        'attempt-1',
        'verified_pending_provision',
        expect.objectContaining({
          completionResult: expect.objectContaining({
            tokens: auth0Token,
          }),
        })
      );
    });

    it('rejects Auth0 tokens that omit the attempt contact claim', async () => {
      const pending = baseAttempt();
      attemptStore.findById.mockResolvedValue(pending);
      attemptStore.claimForVerify.mockResolvedValue(pending);
      auth0Service.verifyEmailOtp.mockResolvedValue({
        ...auth0Token,
        id_token:
          'eyJhbGciOiJub25lIn0.' +
          Buffer.from(JSON.stringify({ sub: 'email|1' })).toString('base64url') +
          '.',
      });

      await expect(
        service.verifySignupOtp({ attemptId: 'attempt-1', otp: '123456' })
      ).rejects.toMatchObject({ status: 409 });
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
      expect(attemptStore.updateStatus).toHaveBeenCalledWith(
        'attempt-1',
        'pending'
      );
    });
  });

  describe('retired endpoints', () => {
    it('returns GONE for updateContact', async () => {
      await expect(service.updateContact({})).rejects.toThrow(
        new HttpException(
          {
            success: false,
            error: 'Contact updates require restarting signup verification',
          },
          HttpStatus.GONE
        )
      );
    });
  });
});
