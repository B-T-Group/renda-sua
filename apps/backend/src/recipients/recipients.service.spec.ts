import { HttpException, HttpStatus } from '@nestjs/common';
import { RecipientsService } from './recipients.service';
import type { RequestContext } from '../auth/request-context';

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
      expect(executeQuery).toHaveBeenCalledWith(
        mockCtx,
        expect.stringContaining('ListRecipients'),
        { userId, country: null }
      );
    });

    it('filters recipients by country when provided', async () => {
      executeQuery.mockResolvedValue({
        user_recipients: [mockRecipient],
      });

      await service.listRecipients(mockCtx, 'GA');

      expect(executeQuery).toHaveBeenCalledWith(
        mockCtx,
        expect.any(String),
        { userId, country: 'GA' }
      );
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
        mockCtx,
        expect.stringContaining('GetRecipient'),
        { id: recipientId, userId }
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
        mockCtx,
        expect.stringContaining('CreateRecipient'),
        expect.objectContaining({
          userId,
          country: 'GA',
          name: 'Jane Smith',
          phone: '+241077123456',
          notifyWhatsapp: false,
        })
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
        mockCtx,
        expect.stringContaining('DeleteRecipient'),
        { id: recipientId, userId }
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
});
