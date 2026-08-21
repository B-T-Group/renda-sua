import {
  CONTRACT_DOC_TYPE,
  pickUploadViewUrl,
  resolveSignedPdfUrl,
  selectLatestContractUploadId,
} from './signedContractPdf';

function mockApi(handlers: Record<string, unknown>) {
  return {
    get: jest.fn(async (url: string) => {
      const key = Object.keys(handlers).find((k) => url.includes(k));
      if (!key) throw new Error(`unexpected url ${url}`);
      return { data: handlers[key] };
    }),
  };
}

describe('selectLatestContractUploadId', () => {
  it('picks the newest contract upload and ignores other docs', () => {
    expect(
      selectLatestContractUploadId([
        {
          id: 'id-card',
          created_at: '2026-08-21T12:00:00Z',
          document_type: { name: 'id_card' },
        },
        {
          id: 'old-contract',
          created_at: '2026-08-01T00:00:00Z',
          document_type: { name: CONTRACT_DOC_TYPE },
        },
        {
          id: 'new-contract',
          created_at: '2026-08-20T00:00:00Z',
          document_type: { name: CONTRACT_DOC_TYPE },
        },
      ])
    ).toBe('new-contract');
  });

  it('returns null when no contract uploads exist', () => {
    expect(
      selectLatestContractUploadId([
        { id: 'id-card', document_type: { name: 'id_card' } },
      ])
    ).toBeNull();
  });
});

describe('pickUploadViewUrl', () => {
  it('prefers top-level then nested presigned urls', () => {
    expect(pickUploadViewUrl({ presigned_url: 'top' })).toBe('top');
    expect(
      pickUploadViewUrl({ data: { presigned_url: 'nested' } })
    ).toBe('nested');
    expect(pickUploadViewUrl({ data: { url: 'legacy' } })).toBe('legacy');
    expect(pickUploadViewUrl({})).toBeNull();
  });
});

describe('resolveSignedPdfUrl', () => {
  it('downloads the BoldSign PDF when the contract is downloadable', async () => {
    const api = mockApi({
      '/business-contracts/c1/download': {
        success: true,
        data: { url: 'https://boldsign/signed.pdf' },
      },
    });
    await expect(
      resolveSignedPdfUrl(api, {
        canDownload: true,
        contractId: 'c1',
        boldSignEnabled: true,
      })
    ).resolves.toBe('https://boldsign/signed.pdf');
    expect(api.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/uploads/me')
    );
  });

  it('does not open a stale in-app upload on the BoldSign rail', async () => {
    const api = mockApi({
      '/uploads/me': {
        success: true,
        data: {
          uploads: [
            { id: 'stale', document_type: { name: CONTRACT_DOC_TYPE } },
          ],
        },
      },
    });
    await expect(
      resolveSignedPdfUrl(api, {
        canDownload: false,
        contractId: 'c1',
        boldSignEnabled: true,
      })
    ).resolves.toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('falls back to the latest in-app contract upload view url', async () => {
    const api = mockApi({
      '/uploads/me': {
        success: true,
        data: {
          uploads: [
            {
              id: 'u-old',
              created_at: '2026-01-01T00:00:00Z',
              document_type: { name: CONTRACT_DOC_TYPE },
            },
            {
              id: 'u-new',
              created_at: '2026-08-20T00:00:00Z',
              document_type: { name: CONTRACT_DOC_TYPE },
            },
          ],
        },
      },
      '/uploads/u-new/view': { data: { url: 'https://s3/new.pdf' } },
    });
    await expect(resolveSignedPdfUrl(api, null)).resolves.toBe(
      'https://s3/new.pdf'
    );
  });
});
