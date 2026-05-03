import { HttpException, HttpStatus } from '@nestjs/common';
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
    };
    controller = new UsersController(
      hasuraUserService as any,
      hasuraSystemService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
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
