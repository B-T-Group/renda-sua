import { Test, TestingModule } from '@nestjs/testing';
import { Auth0ActionsController } from './auth0-actions.controller';
import { HasuraSystemService } from '../hasura/hasura-system.service';

describe('Auth0ActionsController', () => {
  let controller: Auth0ActionsController;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;

  beforeEach(async () => {
    const mockHasuraSystemService = {
      executeQuery: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [Auth0ActionsController],
      providers: [
        {
          provide: HasuraSystemService,
          useValue: mockHasuraSystemService,
        },
      ],
    }).compile();

    controller = module.get<Auth0ActionsController>(Auth0ActionsController);
    hasuraSystemService = module.get(HasuraSystemService);
  });

  describe('resolveUserId', () => {
    const testUserId = '550e8400-e29b-41d4-a716-446655440000';

    it('should resolve user by email', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ id: testUserId }],
      });

      const result = await controller.resolveUserId({
        email: 'test@example.com',
      });

      expect(result).toEqual({
        user_id: testUserId,
        found: true,
      });
      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('ResolveUserIdByEmail'),
        { email: 'test@example.com' }
      );
    });

    it('should resolve user by phone number', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ id: testUserId }],
      });

      const result = await controller.resolveUserId({
        phone_number: '+237670000000',
      });

      expect(result).toEqual({
        user_id: testUserId,
        found: true,
      });
      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('ResolveUserIdByPhone'),
        { phone: '+237670000000' }
      );
    });

    it('should normalize email to lowercase', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ id: testUserId }],
      });

      await controller.resolveUserId({
        email: 'Test@Example.COM',
      });

      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        { email: 'test@example.com' }
      );
    });

    it('should return not found when user does not exist', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [],
      });

      const result = await controller.resolveUserId({
        email: 'nonexistent@example.com',
      });

      expect(result).toEqual({
        user_id: null,
        found: false,
      });
    });

    it('should return not found when no email or phone provided', async () => {
      const result = await controller.resolveUserId({});

      expect(result).toEqual({
        user_id: null,
        found: false,
      });
      expect(hasuraSystemService.executeQuery).not.toHaveBeenCalled();
    });

    it('should prefer email when both email and phone provided', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ id: testUserId }],
      });

      await controller.resolveUserId({
        email: 'test@example.com',
        phone_number: '+237670000000',
      });

      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('ResolveUserIdByEmail'),
        { email: 'test@example.com' }
      );
    });

    it('should handle Hasura query errors gracefully', async () => {
      hasuraSystemService.executeQuery.mockRejectedValue(
        new Error('Hasura connection failed')
      );

      const result = await controller.resolveUserId({
        email: 'test@example.com',
      });

      expect(result).toEqual({
        user_id: null,
        found: false,
      });
    });

    it('should trim whitespace from email', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ id: testUserId }],
      });

      await controller.resolveUserId({
        email: '  test@example.com  ',
      });

      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        { email: 'test@example.com' }
      );
    });

    it('should trim whitespace from phone number', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [{ id: testUserId }],
      });

      await controller.resolveUserId({
        phone_number: '  +237670000000  ',
      });

      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        { phone: '+237670000000' }
      );
    });

    it('should handle empty users array from Hasura', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: [],
      });

      const result = await controller.resolveUserId({
        email: 'test@example.com',
      });

      expect(result).toEqual({
        user_id: null,
        found: false,
      });
    });

    it('should handle null users array from Hasura', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        users: null as any,
      });

      const result = await controller.resolveUserId({
        email: 'test@example.com',
      });

      expect(result).toEqual({
        user_id: null,
        found: false,
      });
    });
  });
});
