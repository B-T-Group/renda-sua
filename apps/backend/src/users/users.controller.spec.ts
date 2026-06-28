import { HttpException, HttpStatus } from '@nestjs/common';

jest.mock('../addresses/addresses.service', () => ({
  AddressesService: jest.fn(),
}));
jest.mock('../agents/agent-referrals.service', () => ({
  AgentReferralsService: jest.fn(),
}));
jest.mock('../hasura/hasura-system.service', () => ({
  HasuraSystemService: jest.fn(),
}));
jest.mock('../hasura/hasura-user.service', () => ({
  HasuraUserService: jest.fn(),
}));

import { UsersController } from './users.controller';

describe('UsersController', () => {
  let controller: UsersController;
  let hasuraUserService: {
    getUser: jest.Mock;
    getUserId: jest.Mock;
    executeMutation: jest.Mock;
  };
  let hasuraSystemService: {
    executeQuery: jest.Mock;
    executeMutation: jest.Mock;
  };
  let addressesService: {
    resolveSourceAddressForPersonaSeed: jest.Mock;
    seedDefaultAddressForNewPersona: jest.Mock;
  };
  let paymentRoutingService: {
    resolveRailForCountry: jest.Mock;
    getUserCountryCode: jest.Mock;
  };

  const currentUser = {
    id: 'user-123',
    email: 'current@example.com',
    email_verified: false,
    first_name: 'Current',
    last_name: 'User',
    phone_number: '+237600000001',
    phone_number_verified: false,
    preferred_language: 'en',
    timezone: 'Africa/Douala',
  };

  beforeEach(() => {
    hasuraUserService = {
      getUser: jest.fn().mockResolvedValue(currentUser),
      getUserId: jest.fn().mockReturnValue(currentUser.id),
      executeMutation: jest.fn(),
    };
    hasuraSystemService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };
    addressesService = {
      resolveSourceAddressForPersonaSeed: jest.fn().mockResolvedValue(null),
      seedDefaultAddressForNewPersona: jest.fn().mockResolvedValue(undefined),
    };
    paymentRoutingService = {
      resolveRailForCountry: jest.fn().mockResolvedValue('mobile_money'),
      getUserCountryCode: jest.fn().mockResolvedValue(null),
    };
    controller = new UsersController(
      hasuraUserService as any,
      hasuraSystemService as any,
      {} as any,
      addressesService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      paymentRoutingService as any
    );
  });

  describe('getCurrentUser', () => {
    const auth0User = {
      sub: 'auth0|user-123',
      email: 'current@example.com',
      email_verified: true,
    };

    it('uses the primary address country and exposes Stripe availability', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        ...currentUser,
        client: { id: 'client-123' },
        addresses: [
          {
            country: 'CA',
            is_primary: false,
            created_at: '2026-06-01T00:00:00Z',
          },
          {
            country: ' cm ',
            is_primary: true,
            created_at: '2026-05-01T00:00:00Z',
          },
        ],
      });
      paymentRoutingService.resolveRailForCountry.mockResolvedValue('stripe');

      await expect(controller.getCurrentUser(auth0User)).resolves.toMatchObject({
        success: true,
        user: {
          id: currentUser.id,
          personas: ['client'],
          country: 'CM',
          is_stripe_enabled: true,
        },
        userId: currentUser.id,
        auth0User,
      });
      expect(paymentRoutingService.getUserCountryCode).not.toHaveBeenCalled();
      expect(paymentRoutingService.resolveRailForCountry).toHaveBeenCalledWith(
        'CM'
      );
    });

    it('falls back to persona-derived country when addresses lack country', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        ...currentUser,
        addresses: [
          {
            country: ' ',
            is_primary: true,
            created_at: '2026-06-01T00:00:00Z',
          },
        ],
      });
      paymentRoutingService.getUserCountryCode.mockResolvedValue(' ca ');

      await expect(controller.getCurrentUser(auth0User)).resolves.toMatchObject({
        success: true,
        user: {
          id: currentUser.id,
          country: 'CA',
          is_stripe_enabled: false,
        },
      });
      expect(paymentRoutingService.getUserCountryCode).toHaveBeenCalledWith(
        currentUser.id
      );
      expect(paymentRoutingService.resolveRailForCountry).toHaveBeenCalledWith(
        'CA'
      );
    });
  });

  describe('addPersona', () => {
    const sourceAddress = {
      id: 'addr-1',
      address_line_1: '123 Main St',
      city: 'Douala',
      state: 'Littoral',
      postal_code: '',
      country: 'CM',
      is_primary: true,
    };

    it('seeds client address when active persona has an address', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        ...currentUser,
        user_type_id: 'agent',
        agent: { id: 'agent-1' },
        personas: ['agent'],
      });
      addressesService.resolveSourceAddressForPersonaSeed.mockResolvedValue(
        sourceAddress
      );
      hasuraSystemService.executeMutation.mockResolvedValue({
        insert_clients_one: { id: 'client-new' },
      });

      await expect(
        controller.addPersona('client', {})
      ).resolves.toEqual({
        success: true,
        client: { id: 'client-new' },
      });

      expect(
        addressesService.resolveSourceAddressForPersonaSeed
      ).toHaveBeenCalledWith(currentUser.id, expect.objectContaining({ agent: { id: 'agent-1' } }));
      expect(
        addressesService.seedDefaultAddressForNewPersona
      ).toHaveBeenCalledWith(
        currentUser.id,
        'client-new',
        'client',
        sourceAddress
      );
    });

    it('does not seed when active persona has no address', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        ...currentUser,
        user_type_id: 'agent',
        agent: { id: 'agent-1' },
        personas: ['agent'],
      });
      addressesService.resolveSourceAddressForPersonaSeed.mockResolvedValue(null);
      hasuraSystemService.executeMutation.mockResolvedValue({
        insert_clients_one: { id: 'client-new' },
      });

      await controller.addPersona('client', {});

      expect(
        addressesService.seedDefaultAddressForNewPersona
      ).not.toHaveBeenCalled();
    });

    it('seeds business address and location name from business name', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        ...currentUser,
        user_type_id: 'client',
        client: { id: 'client-1' },
        personas: ['client'],
      });
      addressesService.resolveSourceAddressForPersonaSeed.mockResolvedValue(
        sourceAddress
      );
      hasuraSystemService.executeMutation.mockResolvedValue({
        insert_businesses_one: { id: 'biz-new', name: 'Shop' },
      });

      await controller.addPersona('business', {
        name: 'Shop',
        main_interest: 'sell_items',
      });

      expect(
        addressesService.seedDefaultAddressForNewPersona
      ).toHaveBeenCalledWith(
        currentUser.id,
        'biz-new',
        'business',
        sourceAddress,
        'Shop'
      );
    });

    it('skips insert and seed when client persona already exists', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        ...currentUser,
        user_type_id: 'client',
        client: { id: 'client-1' },
        personas: ['client'],
      });

      await expect(controller.addPersona('client', {})).resolves.toEqual({
        success: true,
        client: { id: 'client-1' },
      });

      expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
      expect(
        addressesService.resolveSourceAddressForPersonaSeed
      ).not.toHaveBeenCalled();
    });
  });

  describe('updateCurrentUser', () => {
    it('blocks changing a verified phone number from profile settings', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        ...currentUser,
        phone_number_verified: true,
      });

      await expect(
        controller.updateCurrentUser({
          firstName: 'Current',
          lastName: 'User',
          phoneNumber: '+237600000002',
        })
      ).rejects.toThrow(
        new HttpException(
          {
            success: false,
            error:
              'Phone number is verified and cannot be changed from profile settings.',
          },
          HttpStatus.BAD_REQUEST
        )
      );
      expect(hasuraUserService.executeMutation).not.toHaveBeenCalled();
    });

    it('clears phone verification when an unverified phone changes', async () => {
      const updatedUser = {
        ...currentUser,
        phone_number: '+237600000002',
        phone_number_verified: false,
      };
      hasuraUserService.executeMutation.mockResolvedValue({
        update_users_by_pk: updatedUser,
      });

      await expect(
        controller.updateCurrentUser({
          firstName: 'Current',
          lastName: 'User',
          phoneNumber: ' +237600000002 ',
          preferredLanguage: 'fr',
        })
      ).resolves.toEqual({ success: true, user: updatedUser });
      expect(hasuraUserService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('mutation UpdateUser'),
        expect.objectContaining({
          phone_number: '+237600000002',
          phone_number_verified: false,
          preferred_language: 'fr',
        })
      );
    });
  });

  describe('updateCurrentUserPhone', () => {
    it('blocks changing a verified phone number', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        ...currentUser,
        phone_number_verified: true,
      });

      await expect(
        controller.updateCurrentUserPhone({ phoneNumber: '+237600000002' })
      ).rejects.toThrow(
        new HttpException(
          {
            success: false,
            error:
              'Phone number is verified and cannot be changed from profile settings.',
          },
          HttpStatus.BAD_REQUEST
        )
      );
      expect(hasuraUserService.executeMutation).not.toHaveBeenCalled();
    });

    it('returns current user when phone is unchanged', async () => {
      await expect(
        controller.updateCurrentUserPhone({ phoneNumber: ' +237600000001 ' })
      ).resolves.toEqual({ success: true, user: currentUser });
      expect(hasuraSystemService.executeQuery).not.toHaveBeenCalled();
      expect(hasuraUserService.executeMutation).not.toHaveBeenCalled();
    });

    it('persists phone when unverified and number changes', async () => {
      const updatedUser = {
        ...currentUser,
        phone_number: '+237600000002',
        phone_number_verified: false,
      };
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });
      hasuraUserService.executeMutation.mockResolvedValue({
        update_users_by_pk: updatedUser,
      });

      await expect(
        controller.updateCurrentUserPhone({ phoneNumber: '+237600000002' })
      ).resolves.toEqual({ success: true, user: updatedUser });
      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('PhoneTakenExclude'),
        { phone: '+237600000002', excludeId: currentUser.id }
      );
      expect(hasuraUserService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('mutation UpdateUserPhone'),
        expect.objectContaining({
          phone_number: '+237600000002',
          phone_number_verified: false,
        })
      );
    });

    it('rejects when phone is already used by another user', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ id: 'other-user' }],
      });

      await expect(
        controller.updateCurrentUserPhone({ phoneNumber: '+237699999999' })
      ).rejects.toThrow(
        new HttpException(
          { success: false, error: 'Phone number is already in use' },
          HttpStatus.CONFLICT
        )
      );
      expect(hasuraUserService.executeMutation).not.toHaveBeenCalled();
    });

    it('rejects empty phone', async () => {
      await expect(controller.updateCurrentUserPhone({ phoneNumber: '  ' })).rejects.toThrow(
        new HttpException(
          { success: false, error: 'Phone number is required' },
          HttpStatus.BAD_REQUEST
        )
      );
    });
  });

  describe('updateCurrentUserEmail', () => {
    it('normalizes and persists an available email as unverified', async () => {
      const updatedUser = {
        ...currentUser,
        email: 'new@example.com',
        email_verified: false,
      };
      hasuraSystemService.executeQuery.mockResolvedValue({ users: [] });
      hasuraUserService.executeMutation.mockResolvedValue({
        update_users_by_pk: updatedUser,
      });

      await expect(
        controller.updateCurrentUserEmail({ email: ' New@Example.COM ' })
      ).resolves.toEqual({ success: true, user: updatedUser });
      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('EmailTakenExclude'),
        { email: 'new@example.com', excludeId: currentUser.id }
      );
      expect(hasuraUserService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('email_verified: false'),
        { id: currentUser.id, email: 'new@example.com' }
      );
    });

    it('returns the current user without writes when email is unchanged', async () => {
      await expect(
        controller.updateCurrentUserEmail({ email: ' Current@Example.COM ' })
      ).resolves.toEqual({ success: true, user: currentUser });
      expect(hasuraSystemService.executeQuery).not.toHaveBeenCalled();
      expect(hasuraUserService.executeMutation).not.toHaveBeenCalled();
    });

    it('blocks changing a verified email before checking conflicts', async () => {
      hasuraUserService.getUser.mockResolvedValue({
        ...currentUser,
        email_verified: true,
      });

      await expect(
        controller.updateCurrentUserEmail({ email: 'new@example.com' })
      ).rejects.toThrow(
        new HttpException(
          {
            success: false,
            error: 'Email is verified and cannot be changed from profile settings.',
          },
          HttpStatus.BAD_REQUEST
        )
      );
      expect(hasuraSystemService.executeQuery).not.toHaveBeenCalled();
      expect(hasuraUserService.executeMutation).not.toHaveBeenCalled();
    });

    it('rejects emails already used by another user', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ id: 'other-user' }],
      });

      await expect(
        controller.updateCurrentUserEmail({ email: 'taken@example.com' })
      ).rejects.toThrow(
        new HttpException(
          { success: false, error: 'Email is already taken' },
          HttpStatus.CONFLICT
        )
      );
      expect(hasuraUserService.executeMutation).not.toHaveBeenCalled();
    });
  });
});
