import { HttpStatus } from '@nestjs/common';
import { UploadService } from './upload.service';

describe('UploadService ID rejection inbox', () => {
  let hasura: { executeQuery: jest.Mock; executeMutation: jest.Mock };
  let notifications: { sendBusinessIdDocumentRejectedEmail: jest.Mock };
  let lifecycle: { recomputeForBusiness: jest.Mock };
  let service: UploadService;

  beforeEach(() => {
    hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
    notifications = {
      sendBusinessIdDocumentRejectedEmail: jest.fn().mockResolvedValue(undefined),
    };
    lifecycle = { recompute: jest.fn().mockResolvedValue(undefined) };
    service = new UploadService(
      {} as any,
      hasura as any,
      {} as any,
      {} as any,
      notifications as any,
      lifecycle as any
    );
  });

  it('returns 404 when the upload cannot be updated', async () => {
    hasura.executeMutation.mockResolvedValue({ update_user_uploads_by_pk: null });
    await expect(service.rejectUpload('up-1', 'blurry')).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
    expect(hasura.executeQuery).not.toHaveBeenCalled();
  });

  it('does not notify for non-ID document types', async () => {
    hasura.executeMutation.mockResolvedValue({
      update_user_uploads_by_pk: { id: 'up-1' },
    });
    hasura.executeQuery.mockResolvedValue({
      user_uploads_by_pk: {
        user_id: 'user-1',
        document_type: { name: 'order_receipt' },
      },
    });

    await service.rejectUpload('up-1', 'not used');
    await flushAsync();

    expect(notifications.sendBusinessIdDocumentRejectedEmail).not.toHaveBeenCalled();
    expect(
      hasura.executeMutation.mock.calls.some((c) =>
        String(c[0]).includes('InsertIdRejectionMessage')
      )
    ).toBe(false);
  });

  it('writes an inbox message then emails, even if inbox insert fails', async () => {
    hasura.executeMutation.mockImplementation(async (query: string) => {
      if (String(query).includes('RejectUserUpload')) {
        return { update_user_uploads_by_pk: { id: 'up-1' } };
      }
      if (String(query).includes('InsertIdRejectionMessage')) {
        throw new Error('inbox down');
      }
      return {};
    });
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (String(query).includes('GetUploadWithType')) {
        return {
          user_uploads_by_pk: {
            user_id: 'user-1',
            document_type: { name: 'passport' },
          },
        };
      }
      return { businesses: [{ id: 'biz-1' }] };
    });

    await service.rejectUpload('up-1', '  name mismatch  ');
    await flushAsync();

    const inboxCall = hasura.executeMutation.mock.calls.find((c) =>
      String(c[0]).includes('InsertIdRejectionMessage')
    );
    expect(inboxCall?.[1]).toEqual({
      userId: 'user-1',
      uploadId: 'up-1',
      message: 'name mismatch',
    });
    expect(notifications.sendBusinessIdDocumentRejectedEmail).toHaveBeenCalledWith({
      businessUserId: 'user-1',
      documentType: 'passport',
      reason: '  name mismatch  ',
    });
  });

  it('skips the inbox insert when the rejection reason is blank', async () => {
    hasura.executeMutation.mockResolvedValue({
      update_user_uploads_by_pk: { id: 'up-1' },
    });
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (String(query).includes('GetUploadWithType')) {
        return {
          user_uploads_by_pk: {
            user_id: 'user-1',
            document_type: { name: 'id_card' },
          },
        };
      }
      return { businesses: [{ id: 'biz-1' }] };
    });

    await service.rejectUpload('up-1', '   ');
    await flushAsync();

    expect(
      hasura.executeMutation.mock.calls.some((c) =>
        String(c[0]).includes('InsertIdRejectionMessage')
      )
    ).toBe(false);
    expect(notifications.sendBusinessIdDocumentRejectedEmail).toHaveBeenCalled();
  });

  async function flushAsync() {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  }
});
