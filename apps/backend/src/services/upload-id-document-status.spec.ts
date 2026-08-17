jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: jest.fn(),
}));
import { HttpException, HttpStatus } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { UploadService } from './upload.service';

describe('UploadService ID document note guards', () => {
  let service: UploadService;
  let hasuraUser: { executeQuery: jest.Mock };
  let hasuraSystem: { executeQuery: jest.Mock; executeMutation: jest.Mock };

  beforeEach(() => {
    hasuraUser = { executeQuery: jest.fn() };
    hasuraSystem = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };
    service = new UploadService(
      hasuraUser as unknown as HasuraUserService,
      hasuraSystem as unknown as HasuraSystemService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
  });

  describe('hasIdDocument', () => {
    it('returns rejected when latest unapproved upload has a rejection note', async () => {
      hasuraUser.executeQuery.mockResolvedValue({
        user_uploads: [
          {
            id: 'u1',
            is_approved: false,
            note: '[REJECTED] Blurry photo',
          },
        ],
      });

      await expect(service.hasIdDocument('user-1')).resolves.toEqual({
        hasIdDocument: true,
        idDocumentStatus: 'rejected',
      });
    });

    it('returns pending when note is empty and nothing is approved', async () => {
      hasuraUser.executeQuery.mockResolvedValue({
        user_uploads: [{ id: 'u1', is_approved: false, note: null }],
      });

      await expect(service.hasIdDocument('user-1')).resolves.toEqual({
        hasIdDocument: true,
        idDocumentStatus: 'pending',
      });
    });

    it('returns approved when any upload is approved', async () => {
      hasuraUser.executeQuery.mockResolvedValue({
        user_uploads: [
          { id: 'u2', is_approved: false, note: '[REJECTED] old' },
          { id: 'u1', is_approved: true, note: null },
        ],
      });

      await expect(service.hasIdDocument('user-1')).resolves.toEqual({
        hasIdDocument: true,
        idDocumentStatus: 'approved',
      });
    });
  });

  describe('updateUploadNote', () => {
    it('blocks note updates on ID document types', async () => {
      hasuraSystem.executeQuery.mockResolvedValue({
        user_uploads_by_pk: {
          user_id: 'user-1',
          document_type: { name: 'passport' },
        },
      });

      await expect(
        service.updateUploadNote('upload-1', 'user memo', 'user-1')
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
      expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
    });

    it('rejects updates from a different owner', async () => {
      hasuraSystem.executeQuery.mockResolvedValue({
        user_uploads_by_pk: {
          user_id: 'owner-1',
          document_type: { name: 'other' },
        },
      });

      await expect(
        service.updateUploadNote('upload-1', 'memo', 'other-user')
      ).rejects.toBeInstanceOf(HttpException);
      await expect(
        service.updateUploadNote('upload-1', 'memo', 'other-user')
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
      expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
    });

    it('updates notes for non-ID documents owned by the caller', async () => {
      hasuraSystem.executeQuery.mockResolvedValue({
        user_uploads_by_pk: {
          user_id: 'user-1',
          document_type: { name: 'other' },
        },
      });
      hasuraSystem.executeMutation.mockResolvedValue({
        update_user_uploads_by_pk: {
          id: 'upload-1',
          note: 'ok',
          updated_at: '2026-08-06T00:00:00.000Z',
        },
      });

      const result = await service.updateUploadNote(
        'upload-1',
        'ok',
        'user-1'
      );

      expect(result).toEqual(
        expect.objectContaining({ id: 'upload-1', note: 'ok' })
      );
      expect(hasuraSystem.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('UpdateUserUploadNote'),
        { uploadId: 'upload-1', note: 'ok' }
      );
    });
  });
});
