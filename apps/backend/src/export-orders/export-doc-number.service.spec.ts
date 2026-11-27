import { ExportDocNumberService } from './export-doc-number.service';

describe('ExportDocNumberService', () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  function service(config?: { endpoint?: string; adminSecret?: string }) {
    return new ExportDocNumberService({
      get: () => config,
    } as any);
  }

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as any;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: [['n'], ['BC-0009']] }),
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('allocates a BC for the country and strips quotes from that country', async () => {
    await expect(
      service({
        endpoint: 'http://hasura.internal/v1/graphql/',
        adminSecret: 'secret-1',
      }).next('BC', "C'M")
    ).resolves.toBe('BC-0009');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://hasura.internal/v2/query');
    expect(init.headers['x-hasura-admin-secret']).toBe('secret-1');
    expect(JSON.parse(init.body).args.sql).toBe(
      "SELECT public.next_export_doc_number('BC', 'CM') AS n;"
    );
  });

  it('uses XX for a missing country and NULL for every non-BC prefix', async () => {
    const numbers = service({
      endpoint: 'http://hasura.internal',
      adminSecret: 'secret-1',
    });
    await numbers.next('BC');
    await numbers.next('PRO', 'CM');
    await numbers.next('CR');
    const sql = fetchMock.mock.calls.map(
      (call) => JSON.parse(call[1].body).args.sql
    );
    expect(sql).toEqual([
      "SELECT public.next_export_doc_number('BC', 'XX') AS n;",
      "SELECT public.next_export_doc_number('PRO', NULL) AS n;",
      "SELECT public.next_export_doc_number('CR', NULL) AS n;",
    ]);
  });

  it('fails closed when Hasura or the sequence cell is unusable', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    });
    await expect(
      service({ endpoint: 'http://hasura.internal', adminSecret: 's' }).next(
        'FAC'
      )
    ).rejects.toThrow('Hasura run_sql failed: 503');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: [['n']] }),
    });
    await expect(
      service({ endpoint: 'http://hasura.internal', adminSecret: 's' }).next(
        'REC'
      )
    ).rejects.toThrow('Failed to allocate REC document number');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: [['n'], [9]] }),
    });
    await expect(
      service({ endpoint: 'http://hasura.internal', adminSecret: 's' }).next(
        'CR'
      )
    ).rejects.toThrow('Failed to allocate CR document number');
  });
});
