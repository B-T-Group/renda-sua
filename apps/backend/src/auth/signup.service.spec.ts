import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

// Avoid loading provisioning deps -> notifications circular graph under Jest.
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
    email_verified: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignupService,
        {
          provide: HasuraSystemService,
          useValue: {
            executeQuery: jest.fn().mockResolvedValue({ users_by_pk: null }),
            executeMutation: jest.fn(),
          },
        },
        {
          provide: Auth0Service,
          useValue: {
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
            scheduleEnsureContractForUser: jest.fn().mockResolvedValue(undefined),
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
            trackCompleteRegistrationSafe: jest.fn().mockResolvedValue(undefined),
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
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [{ id: 'u1' }] });

      const taken = await service.isEmailTaken('  Taken@Example.COM  ');

      expect(taken).toBe(true);
      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('ContactTaken'),
        { value: 'taken@example.com' }
      );
    });

    it('normalizes phone before checking if it is taken', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });

      const taken = await service.isPhoneTaken('  +237600000001  ');

      expect(taken).toBe(false);
      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('ContactTaken'),
        { value: '+237600000001' }
      );
    });

    it('treats any existing holder as taken, including unverified rows', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ id: 'pending-or-active' }],
      });
      await expect(service.isEmailTaken('pending@example.com')).resolves.toBe(
        true
      );
      const [query, vars] = hasuraSystemService.executeQuery.mock.calls[0];
      expect(query).toContain('ContactTaken');
      expect(query).not.toContain('email_verified');
      expect(query).not.toContain('phone_number_verified');
      expect(vars).toEqual({ value: 'pending@example.com' });
    });
  });

  describe('contact uniqueness on start', () => {
    it('does not null out existing holders before creating a pending user', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });
      userProvisioning.createPendingUser.mockResolvedValue({
        user: insertedUser,
        entities: [{ id: 'client-123', type: 'client' }],
      });

      await service.startSignup({
        first_name: 'New',
        last_name: 'User',
        email: 'abandoned@example.com',
        personas: ['client'],
        profile: {},
      });

      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalledWith(
        expect.stringContaining('ReleaseUnverifiedContact'),
        expect.anything()
      );
      expect(userProvisioning.createPendingUser).toHaveBeenCalled();
    });

    it('rejects signup when an unverified holder already owns the email', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ id: 'existing-holder' }],
      });

      await expect(
        service.startSignup({
          first_name: 'New',
          last_name: 'User',
          email: 'held@example.com',
          personas: ['client'],
          profile: {},
        })
      ).rejects.toThrow(
        new HttpException(
          { success: false, error: 'Email is already taken' },
          HttpStatus.CONFLICT
        )
      );
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
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

    it('rejects a taken phone before creating a pending user', async () => {
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

    it('creates a phone-only pending signup and seeds legacy addresses', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });
      userProvisioning.createPendingUser.mockResolvedValue({
        user: { ...insertedUser, email: null },
        entities: [
          { id: 'client-123', type: 'client' },
          { id: 'agent-123', type: 'agent' },
        ],
      });

      const address = {
        address_line_1: '123 Main St',
        country: 'CM',
        city: 'Douala',
        state: 'Littoral',
      };
      const result = await service.startSignup({
        ...basePayload,
        phone_number: ' +237600000001 ',
        personas: ['client', 'agent'],
        profile: { vehicle_type_id: 'bike' },
        address,
      });

      expect(result.user.email).toBeNull();
      expect(userProvisioning.createPendingUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: null,
          phone_number: '+237600000001',
          personas: ['client', 'agent'],
          vehicle_type_id: 'bike',
        })
      );
      expect(addressesService.createAddressForSignup).toHaveBeenCalledTimes(2);
      expect(businessProvisioning.runPostCommitEffects).toHaveBeenCalled();
      expect(referralProvisioning.runPostCommitEffects).toHaveBeenCalledWith(
        expect.objectContaining({
          country: 'CM',
        })
      );
      expect(
        metaConversionsService.trackCompleteRegistrationSafe
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'registration-user-123',
          userType: 'client',
          externalId: 'user-123',
          phone: '+237600000001',
        })
      );
    });

    it('nests store_location for business and skips legacy address seed', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });
      userProvisioning.createPendingUser.mockResolvedValue({
        user: insertedUser,
        entities: [{ id: 'biz-1', type: 'business' }],
        businessLocation: {
          id: 'loc-1',
          addressId: 'addr-1',
          country: 'CA',
          city: 'Montreal',
        },
      });

      await service.startSignup({
        first_name: 'Biz',
        last_name: 'Owner',
        email: 'biz@example.com',
        personas: ['business'],
        profile: { name: 'Acme', main_interest: 'sell_items' },
        country: 'CA',
        store_location: {
          street: '1 Main',
          city: 'Montreal',
          region: 'Quebec',
          postal_code: 'H2X1Y4',
        },
      });

      expect(userProvisioning.createPendingUser).toHaveBeenCalledWith(
        expect.objectContaining({
          storeAddress: expect.objectContaining({
            address_line_1: '1 Main',
            country: 'CA',
            postal_code: 'H2X1Y4',
            countryOnly: false,
          }),
        })
      );
      expect(addressesService.createAddressForSignup).not.toHaveBeenCalled();
      expect(businessProvisioning.runPostCommitEffects).toHaveBeenCalledWith(
        expect.objectContaining({
          businessLocation: expect.objectContaining({ id: 'loc-1' }),
        })
      );
    });

    it('still seeds client/agent addresses when business location is nested', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });
      userProvisioning.createPendingUser.mockResolvedValue({
        user: insertedUser,
        entities: [
          { id: 'client-1', type: 'client' },
          { id: 'biz-1', type: 'business' },
        ],
        businessLocation: {
          id: 'loc-1',
          addressId: 'addr-1',
          country: 'CA',
          city: 'Montreal',
        },
      });

      await service.startSignup({
        first_name: 'Biz',
        last_name: 'Owner',
        email: 'biz@example.com',
        personas: ['client', 'business'],
        profile: { name: 'Acme', main_interest: 'sell_items' },
        country: 'CA',
        store_location: {
          street: '1 Main',
          city: 'Montreal',
          region: 'Quebec',
          postal_code: 'H2X1Y4',
        },
      });

      expect(addressesService.createAddressForSignup).toHaveBeenCalledTimes(1);
      expect(addressesService.createAddressForSignup).toHaveBeenCalledWith(
        'user-123',
        'client-1',
        'client',
        expect.objectContaining({
          address_line_1: '1 Main',
          country: 'CA',
          city: 'Montreal',
          state: 'Quebec',
        })
      );
    });

    it('accepts guest checkout client-only payload without country', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });
      userProvisioning.createPendingUser.mockResolvedValue({
        user: insertedUser,
        entities: [{ id: 'client-1', type: 'client' }],
      });

      await service.startSignup({
        first_name: 'Guest',
        last_name: 'Buyer',
        email: 'guest@example.com',
        personas: ['client'],
        profile: {},
      });

      expect(userProvisioning.createPendingUser).toHaveBeenCalledWith(
        expect.objectContaining({
          personas: ['client'],
          storeAddress: undefined,
        })
      );
      expect(addressesService.createAddressForSignup).not.toHaveBeenCalled();
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
      expect(userProvisioning.createPendingUser).not.toHaveBeenCalled();
    });
  });

  describe('completeSignup', () => {
    it('rejects completion when authenticated email differs from pending signup email', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users_by_pk: { id: 'user-123', email: 'pending@example.com' },
      });

      await expect(
        service.completeSignup('user-123', { email: 'other@example.com' })
      ).rejects.toThrow(
        new HttpException(
          { success: false, error: 'Email mismatch for signup completion' },
          HttpStatus.CONFLICT
        )
      );
      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    });

    it('normalizes verified Auth0 email before saving completion', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users_by_pk: { id: 'user-123', email: null },
      });
      hasuraSystemService.executeMutation.mockResolvedValue({
        update_users_by_pk: { ...insertedUser, email_verified: true },
      });

      const result = await service.completeSignup('user-123', {
        email: ' New@Example.COM ',
      });

      expect(result.user.email_verified).toBe(true);
      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('CompleteSignup'),
        { id: 'user-123', email: 'new@example.com' }
      );
      expect(
        businessProvisioning.scheduleEnsureContractForUser
      ).toHaveBeenCalledWith('user-123');
    });
  });

  describe('updateContact', () => {
    const existingPendingUser = {
      first_name: 'Pending',
      last_name: 'Signup',
      email: 'old@example.com',
      phone_number: '+237600000001',
      email_verified: false,
      phone_number_verified: false,
    };

    it('requires a pending signup user id before querying Hasura', async () => {
      await expect(
        service.updateContact({ user_id: '', email: 'new@example.com' })
      ).rejects.toThrow(
        new HttpException(
          { success: false, error: 'user_id is required' },
          HttpStatus.BAD_REQUEST
        )
      );
      expect(hasuraSystemService.executeQuery).not.toHaveBeenCalled();
    });

    it('rejects updates that do not include a new email or phone number', async () => {
      hasuraSystemService.executeQuery.mockResolvedValueOnce({
        users_by_pk: existingPendingUser,
      });

      await expect(
        service.updateContact({ user_id: 'user-123', first_name: 'Updated' })
      ).rejects.toThrow(
        new HttpException(
          { success: false, error: 'Email or phone number is required' },
          HttpStatus.BAD_REQUEST
        )
      );
      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    });

    it('rejects contact updates for already verified signup users', async () => {
      hasuraSystemService.executeQuery.mockResolvedValueOnce({
        users_by_pk: { ...existingPendingUser, email_verified: true },
      });

      await expect(
        service.updateContact({ user_id: 'user-123', email: 'new@example.com' })
      ).rejects.toThrow(
        new HttpException(
          { success: false, error: 'Account already verified' },
          HttpStatus.CONFLICT
        )
      );
      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    });

    it('rejects an email already owned by another user', async () => {
      hasuraSystemService.executeQuery
        .mockResolvedValueOnce({ users_by_pk: existingPendingUser })
        .mockResolvedValueOnce({ users: [{ id: 'other-user' }] });

      await expect(
        service.updateContact({
          user_id: 'user-123',
          email: 'taken@example.com',
        })
      ).rejects.toThrow(
        new HttpException(
          { success: false, error: 'Email is already taken' },
          HttpStatus.CONFLICT
        )
      );
      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    });

    it('preserves an omitted phone number when updating only email', async () => {
      hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('GetSignupUser')) {
          return { users_by_pk: existingPendingUser };
        }
        return { users: [] };
      });
      hasuraSystemService.executeMutation.mockImplementation(async (mutation: string) => {
        if (mutation.includes('UpdateSignupContact')) {
          return {
            update_users_by_pk: {
              ...insertedUser,
              email: 'new@example.com',
              phone_number: '+237600000001',
            },
          };
        }
        return { update_users: { affected_rows: 1 } };
      });

      const result = await service.updateContact({
        user_id: ' user-123 ',
        first_name: ' Renamed ',
        email: ' New@Example.COM ',
      });

      expect(result.user.email).toBe('new@example.com');
      expect(
        businessProvisioning.scheduleEnsureContractForUser
      ).not.toHaveBeenCalled();
      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalledWith(
        expect.stringContaining('ReleaseUnverifiedContact'),
        expect.anything()
      );
      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('UpdateSignupContact'),
        {
          id: 'user-123',
          email: 'new@example.com',
          phone_number: '+237600000001',
          first_name: 'Renamed',
          last_name: 'Signup',
        }
      );
    });

    it('preserves an omitted email when updating only phone number', async () => {
      hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('GetSignupUser')) {
          return { users_by_pk: existingPendingUser };
        }
        return { users: [] };
      });
      hasuraSystemService.executeMutation.mockImplementation(async (mutation: string) => {
        if (mutation.includes('UpdateSignupContact')) {
          return {
            update_users_by_pk: {
              ...insertedUser,
              email: 'old@example.com',
              phone_number: '+237699999999',
            },
          };
        }
        return { update_users: { affected_rows: 1 } };
      });

      await service.updateContact({
        user_id: 'user-123',
        phone_number: ' +237699999999 ',
      });

      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('UpdateSignupContact'),
        {
          id: 'user-123',
          email: 'old@example.com',
          phone_number: '+237699999999',
          first_name: 'Pending',
          last_name: 'Signup',
        }
      );
    });
  });

  describe('verifyOtp', () => {
    it('normalizes email before delegating OTP verification to Auth0', async () => {
      const auth0Token = {
        access_token: 'token',
        token_type: 'Bearer',
        expires_in: 3600,
      };
      auth0Service.verifyEmailOtp.mockResolvedValue(auth0Token);
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ id: 'user-123' }],
      });

      await expect(
        service.verifyOtp({ email: ' New@Example.COM ', otp: '123456' })
      ).resolves.toEqual(auth0Token);
      expect(auth0Service.verifyEmailOtp).toHaveBeenCalledWith(
        'new@example.com',
        '123456'
      );
      expect(
        businessProvisioning.scheduleEnsureContractForUser
      ).toHaveBeenCalledWith('user-123');
    });

    it('schedules merchant contract when userId is provided with OTP', async () => {
      const auth0Token = {
        access_token: 'token',
        token_type: 'Bearer',
        expires_in: 3600,
      };
      auth0Service.verifyEmailOtp.mockResolvedValue(auth0Token);

      await service.verifyOtp({
        email: 'new@example.com',
        otp: '123456',
        userId: 'user-456',
      });

      expect(
        businessProvisioning.scheduleEnsureContractForUser
      ).toHaveBeenCalledWith('user-456');
    });

    it('delegates phone OTP verification to Auth0 SMS', async () => {
      const auth0Token = {
        access_token: 'token',
        token_type: 'Bearer',
        expires_in: 3600,
      };
      auth0Service.verifySmsOtp.mockResolvedValue(auth0Token);

      await expect(
        service.verifyOtp({ phone_number: '+237600000001', otp: '123456' })
      ).resolves.toEqual(auth0Token);
      expect(auth0Service.verifySmsOtp).toHaveBeenCalledWith(
        '+237600000001',
        '123456'
      );
    });

    it('rejects when neither email nor phone is provided', async () => {
      await expect(service.verifyOtp({ otp: '123456' })).rejects.toThrow(
        HttpException
      );
    });

    it('routes test emails to the Test-Users password grant', async () => {
      const auth0Token = {
        access_token: 'token',
        token_type: 'Bearer',
        expires_in: 3600,
      };
      auth0Service.isTestUsersEnabled.mockReturnValue(true);
      auth0Service.isTestEmail.mockReturnValue(true);
      auth0Service.verifyTestUserEmail.mockResolvedValue(auth0Token);

      await expect(
        service.verifyOtp({ email: 'tester@rendasua-test.com', otp: '000000' })
      ).resolves.toEqual(auth0Token);
      expect(auth0Service.verifyTestUserEmail).toHaveBeenCalledWith(
        'tester@rendasua-test.com'
      );
      expect(auth0Service.verifyEmailOtp).not.toHaveBeenCalled();
    });

    it('routes test phones to the Test-Users password grant', async () => {
      const auth0Token = {
        access_token: 'token',
        token_type: 'Bearer',
        expires_in: 3600,
      };
      auth0Service.isTestUsersEnabled.mockReturnValue(true);
      auth0Service.isTestPhone.mockReturnValue(true);
      auth0Service.verifyTestUserPhone.mockResolvedValue(auth0Token);

      await expect(
        service.verifyOtp({ phone_number: '+23700000000', otp: '000000' })
      ).resolves.toEqual(auth0Token);
      expect(auth0Service.verifyTestUserPhone).toHaveBeenCalledWith(
        '+23700000000'
      );
      expect(auth0Service.verifySmsOtp).not.toHaveBeenCalled();
    });

    it('rejects requests that provide both email and phone number', async () => {
      await expect(
        service.verifyOtp({
          email: 'new@example.com',
          phone_number: '+237600000001',
          otp: '123456',
        })
      ).rejects.toThrow(
        new HttpException(
          {
            success: false,
            error: 'Provide exactly one of email or phone_number with otp',
          },
          HttpStatus.BAD_REQUEST
        )
      );
      expect(auth0Service.verifyEmailOtp).not.toHaveBeenCalled();
      expect(auth0Service.verifySmsOtp).not.toHaveBeenCalled();
    });
  });
});
