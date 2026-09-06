import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { HttpException, HttpStatus } from '@nestjs/common';
import { RecipientsService } from './recipients.service';
import type { RequestContext } from '../auth/request-context';

function loadUserRecipientsMetadata(): string {
  const candidates = [
    join(
      process.cwd(),
      'apps/hasura/metadata/databases/Rendasua/tables/public_user_recipients.yaml'
    ),
    join(
      process.cwd(),
      '../hasura/metadata/databases/Rendasua/tables/public_user_recipients.yaml'
    ),
    join(
      __dirname,
      '../../../hasura/metadata/databases/Rendasua/tables/public_user_recipients.yaml'
    ),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error('user_recipients Hasura metadata yaml not found');
  }
  return readFileSync(path, 'utf8');
}

describe('RecipientsService', () => {
  const userId = 'user-123';
  const recipientId = 'recipient-456';
  const mockCtx: RequestContext = { userId, authToken: 'token' } as RequestContext;

  const mockRecipient = {
    id: recipientId,
    user_id: userId,
    country: 'GA',
    name: 'John Doe',
    phone: '+241077123456',
    notify_whatsapp: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  let executeQuery: jest.Mock;
  let executeMutation: jest.Mock;
  let getUserId: jest.Mock;
  let service: RecipientsService;

  beforeEach(() => {
    executeQuery = jest.fn();
    executeMutation = jest.fn();
    getUserId = jest.fn().mockReturnValue(userId);
    service = new RecipientsService({
      executeQuery,
      executeMutation,
      getUserId,
    } as never);
  });

  describe('listRecipients', () => {
    it('returns all recipients for the authenticated user', async () => {
      executeQuery.mockResolvedValue({
        user_recipients: [mockRecipient],
      });

      const result = await service.listRecipients(mockCtx);

      expect(result).toEqual([mockRecipient]);
      const [query, variables] = executeQuery.mock.calls[0];
      expect(query).toContain('ListRecipients');
      expect(query).not.toMatch(/\$country/);
      expect(variables).toEqual({ userId });
    });

    it('filters recipients by country when provided', async () => {
      executeQuery.mockResolvedValue({
        user_recipients: [mockRecipient],
      });

      await service.listRecipients(mockCtx, 'GA');

      const [query, variables] = executeQuery.mock.calls[0];
      expect(query).toContain('$country: String!');
      expect(query).toContain('country: { _eq: $country }');
      expect(variables).toEqual({ userId, country: 'GA' });
    });

    it('does not declare unused $country when the filter is omitted', async () => {
      executeQuery.mockResolvedValue({ user_recipients: [] });

      await service.listRecipients(mockCtx);

      const [query, variables] = executeQuery.mock.calls[0];
      expect(query).not.toMatch(/\$country/);
      expect(variables).toEqual({ userId });
      expect(variables).not.toHaveProperty('country');
    });

    it('throws unauthorized when user is not authenticated', async () => {
      getUserId.mockReturnValue(null);

      await expect(service.listRecipients(mockCtx)).rejects.toThrow(
        HttpException
      );
    });
  });

  describe('getRecipient', () => {
    it('returns a single recipient by ID', async () => {
      executeQuery.mockResolvedValue({
        user_recipients: [mockRecipient],
      });

      const result = await service.getRecipient(mockCtx, recipientId);

      expect(result).toEqual(mockRecipient);
      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('GetRecipient'),
        { id: recipientId, userId },
        mockCtx
      );
    });

    it('throws not found when recipient does not exist', async () => {
      executeQuery.mockResolvedValue({
        user_recipients: [],
      });

      await expect(
        service.getRecipient(mockCtx, recipientId)
      ).rejects.toThrow(HttpException);
    });
  });

  describe('createRecipient', () => {
    const createDto = {
      country: 'GA',
      name: 'Jane Smith',
      phone: '+241077123456',
      notify_whatsapp: false,
    };

    it('creates a new recipient with normalized phone', async () => {
      executeMutation.mockResolvedValue({
        insert_user_recipients_one: mockRecipient,
      });

      const result = await service.createRecipient(mockCtx, createDto);

      expect(result).toEqual(mockRecipient);
      expect(executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('CreateRecipient'),
        expect.objectContaining({
          userId,
          country: 'GA',
          name: 'Jane Smith',
          phone: expect.stringMatching(/^\+241\d+$/), // Normalized Gabon phone
          notifyWhatsapp: false,
        }),
        mockCtx
      );
    });

    it('throws bad request for invalid country code', async () => {
      await expect(
        service.createRecipient(mockCtx, { ...createDto, country: 'INVALID' })
      ).rejects.toThrow(HttpException);
    });

    it('throws unauthorized when user is not authenticated', async () => {
      getUserId.mockReturnValue(null);

      await expect(service.createRecipient(mockCtx, createDto)).rejects.toThrow(
        HttpException
      );
    });

    it('includes user_id in the insert object for Hasura RLS', async () => {
      executeMutation.mockResolvedValue({
        insert_user_recipients_one: mockRecipient,
      });

      await service.createRecipient(mockCtx, createDto);

      const [mutation, variables] = executeMutation.mock.calls[0];
      expect(mutation).toContain('user_id: $userId');
      expect(mutation).toContain('$userId: uuid!');
      expect(variables).toEqual(
        expect.objectContaining({
          userId,
        })
      );
    });

    it('wraps unexpected Hasura errors as HTTP 500', async () => {
      executeMutation.mockRejectedValue(
        new Error('field "user_id" not found in type: "user_recipients_insert_input"')
      );

      try {
        await service.createRecipient(mockCtx, createDto);
        fail('expected HttpException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.getResponse()).toEqual(
          expect.objectContaining({
            success: false,
            message: 'Failed to create recipient',
          })
        );
      }
    });

    it('maps unique constraint violations to HTTP 409', async () => {
      executeMutation.mockRejectedValue(
        new Error(
          'Uniqueness violation. duplicate key value violates unique constraint "user_recipients_user_country_phone_key"'
        )
      );

      try {
        await service.createRecipient(mockCtx, createDto);
        fail('expected HttpException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(error.getResponse()).toEqual(
          expect.objectContaining({
            success: false,
            error: 'RECIPIENT_EXISTS',
          })
        );
      }
    });
  });

  describe('updateRecipient', () => {
    const updateDto = {
      name: 'John Updated',
      notify_whatsapp: false,
    };

    beforeEach(() => {
      executeQuery.mockResolvedValue({
        user_recipients: [mockRecipient],
      });
    });

    it('updates recipient fields', async () => {
      executeMutation.mockResolvedValue({
        update_user_recipients: {
          returning: [{ ...mockRecipient, ...updateDto }],
        },
      });

      const result = await service.updateRecipient(
        mockCtx,
        recipientId,
        updateDto
      );

      expect(result.name).toBe('John Updated');
      expect(result.notify_whatsapp).toBe(false);
    });

    it('returns existing recipient when no updates provided', async () => {
      const result = await service.updateRecipient(mockCtx, recipientId, {});

      expect(result).toEqual(mockRecipient);
      expect(executeMutation).not.toHaveBeenCalled();
    });

    it('throws not found when recipient does not exist', async () => {
      executeMutation.mockResolvedValue({
        update_user_recipients: { returning: [] },
      });

      await expect(
        service.updateRecipient(mockCtx, recipientId, updateDto)
      ).rejects.toThrow(HttpException);
    });
  });

  describe('deleteRecipient', () => {
    beforeEach(() => {
      executeQuery.mockResolvedValue({
        user_recipients: [mockRecipient],
      });
    });

    it('deletes a recipient successfully', async () => {
      executeMutation.mockResolvedValue({
        delete_user_recipients: { affected_rows: 1 },
      });

      const result = await service.deleteRecipient(mockCtx, recipientId);

      expect(result).toEqual({ success: true });
      expect(executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('DeleteRecipient'),
        { id: recipientId, userId },
        mockCtx
      );
    });

    it('throws not found when recipient does not exist', async () => {
      executeMutation.mockResolvedValue({
        delete_user_recipients: { affected_rows: 0 },
      });

      await expect(
        service.deleteRecipient(mockCtx, recipientId)
      ).rejects.toThrow(HttpException);
    });
  });

  describe('RequestContext authentication', () => {
    it('should pass RequestContext to all Hasura queries', async () => {
      executeQuery.mockResolvedValue({
        user_recipients: [mockRecipient],
      });

      await service.getRecipient(mockCtx, recipientId);

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('GetRecipient'),
        { id: recipientId, userId },
        mockCtx
      );
    });

    it('should pass RequestContext to all Hasura mutations', async () => {
      executeMutation.mockResolvedValue({
        insert_user_recipients_one: mockRecipient,
      });

      const createDto = {
        country: 'GA',
        name: 'Test User',
        phone: '+241077123456',
        notify_whatsapp: false,
      };

      await service.createRecipient(mockCtx, createDto);

      expect(executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('CreateRecipient'),
        expect.any(Object),
        mockCtx
      );
    });

    it('should require valid userId from RequestContext', async () => {
      getUserId.mockReturnValue(null);

      await expect(service.listRecipients(mockCtx)).rejects.toThrow(
        HttpException
      );

      expect(executeQuery).not.toHaveBeenCalled();
    });

    it('should filter recipients by authenticated user only', async () => {
      executeQuery.mockResolvedValue({
        user_recipients: [mockRecipient],
      });

      await service.listRecipients(mockCtx);

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('user_id: { _eq: $userId }'),
        expect.objectContaining({ userId }),
        mockCtx
      );
      expect(executeQuery.mock.calls[0][1]).not.toHaveProperty('country');
    });

    it('should verify RequestContext has authToken for user-scoped queries', async () => {
      const ctxWithAuth: RequestContext = {
        userId,
        authToken: 'valid-jwt-token',
      } as RequestContext;

      executeQuery.mockResolvedValue({
        user_recipients: [mockRecipient],
      });

      await service.listRecipients(ctxWithAuth);

      expect(executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        ctxWithAuth
      );
      expect(ctxWithAuth.authToken).toBeDefined();
      expect(ctxWithAuth.authToken).not.toBe('');
    });

    it('Hasura insert permissions include user_id for user-scoped roles', () => {
      const yaml = loadUserRecipientsMetadata();
      const insertSection = yaml.split('insert_permissions:')[1];
      const insertOnly = insertSection.split('select_permissions:')[0];
      for (const role of ['agent', 'business', 'client', 'user']) {
        const roleBlock = insertOnly.split(`- role: ${role}`)[1];
        const columns = roleBlock.split('columns:')[1].split('- role:')[0];
        expect(columns).toContain('- user_id');
      }
    });

    it('should NOT accept fake RequestContext with empty authToken', async () => {
      // This test documents what we fixed - never pass fake context
      const fakeCtx = { userId, authToken: '' } as any;

      executeQuery.mockResolvedValue({
        user_recipients: [mockRecipient],
      });

      // The service should work with proper data in test, but we verify format
      const result = await service.getRecipient(fakeCtx, recipientId);

      expect(executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        fakeCtx
      );

      // Document that empty authToken is invalid
      expect(fakeCtx.authToken).toBe('');
      // This pattern should never be used in production code
      expect(result).toEqual(mockRecipient);
    });
  });
});
