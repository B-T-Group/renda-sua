import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AddressesService } from '../addresses/addresses.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { Auth0Service } from './auth0.service';
import { SignupService } from './signup.service';

describe('SignupService', () => {
  let service: SignupService;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let auth0Service: jest.Mocked<Auth0Service>;
  let addressesService: jest.Mocked<AddressesService>;

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
            executeQuery: jest.fn(),
            executeMutation: jest.fn(),
            insertUserWithPersonas: jest.fn(),
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
      ],
    }).compile();

    service = module.get<SignupService>(SignupService);
    hasuraSystemService = module.get(HasuraSystemService);
    auth0Service = module.get(Auth0Service);
    addressesService = module.get(AddressesService);
  });

  describe('availability checks', () => {
    it('normalizes email before checking if it is taken', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [{ id: 'u1' }] });

      const taken = await service.isEmailTaken('  Taken@Example.COM  ');

      expect(taken).toBe(true);
      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('EmailTaken'),
        { email: 'taken@example.com' }
      );
    });

    it('normalizes phone before checking if it is taken', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });

      const taken = await service.isPhoneTaken('  +237600000001  ');

      expect(taken).toBe(false);
      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('PhoneTaken'),
        { phone: '+237600000001' }
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
      expect(hasuraSystemService.insertUserWithPersonas).not.toHaveBeenCalled();
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
      expect(hasuraSystemService.insertUserWithPersonas).not.toHaveBeenCalled();
    });

    it('creates a phone-only pending signup and links returned personas to the address', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });
      hasuraSystemService.insertUserWithPersonas.mockResolvedValue({
        user: { ...insertedUser, email: null },
        client: { id: 'client-123' },
        agent: { id: 'agent-123' },
        business: null,
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
      expect(hasuraSystemService.insertUserWithPersonas).toHaveBeenCalledWith(
        expect.objectContaining({
          email: null,
          phone_number: '+237600000001',
          personas: ['client', 'agent'],
          vehicle_type_id: 'bike',
        })
      );
      expect(addressesService.createAddressForSignup).toHaveBeenCalledTimes(2);
      expect(addressesService.createAddressForSignup).toHaveBeenCalledWith(
        'user-123',
        'client-123',
        'client',
        address
      );
      expect(addressesService.createAddressForSignup).toHaveBeenCalledWith(
        'user-123',
        'agent-123',
        'agent',
        address
      );
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

      await expect(
        service.verifyOtp({ email: ' New@Example.COM ', otp: '123456' })
      ).resolves.toEqual(auth0Token);
      expect(auth0Service.verifyEmailOtp).toHaveBeenCalledWith(
        'new@example.com',
        '123456'
      );
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
  });
});
