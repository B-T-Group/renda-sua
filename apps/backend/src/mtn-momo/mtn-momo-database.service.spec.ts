const mockRequest = jest.fn();

jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: (query: string, variables: unknown) => mockRequest(query, variables),
  })),
}));

import { MtnMomoDatabaseService } from './mtn-momo-database.service';

describe('MtnMomoDatabaseService pending settlement', () => {
  const db = new MtnMomoDatabaseService({ get: () => undefined } as never);

  beforeEach(() => mockRequest.mockReset());

  it('moves a PENDING row once and reports a lost race', async () => {
    mockRequest.mockResolvedValueOnce({
      update_mtn_momo_payment_requests: { affected_rows: 1 },
    });
    await expect(
      db.completePendingPaymentRequest('tx-1', 'SUCCESSFUL')
    ).resolves.toBe(true);
    const [mutation, variables] = mockRequest.mock.calls[0];
    expect(mutation).toContain('status: {_eq: "PENDING"}');
    expect(variables).toEqual({ transactionId: 'tx-1', status: 'SUCCESSFUL' });

    mockRequest.mockResolvedValueOnce({
      update_mtn_momo_payment_requests: { affected_rows: 0 },
    });
    await expect(db.completePendingPaymentRequest('tx-1', 'FAILED')).resolves.toBe(
      false
    );
  });

  it('lists only PENDING rows at or before the cutoff, oldest first', async () => {
    const olderThan = new Date('2026-10-28T09:00:00.000Z');
    mockRequest.mockResolvedValue({
      mtn_momo_payment_requests: [{ transaction_id: 'a', external_id: 'o' }],
    });
    await expect(db.getPendingPaymentRequests(olderThan, 50)).resolves.toEqual([
      { transaction_id: 'a', external_id: 'o' },
    ]);
    const [query, variables] = mockRequest.mock.calls[0];
    expect(query).toContain('status: {_eq: "PENDING"}');
    expect(query).toContain('created_at: {_lte: $olderThan}');
    expect(query).toContain('order_by: {created_at: asc}');
    expect(variables).toEqual({
      olderThan: olderThan.toISOString(),
      limit: 50,
    });
  });
});
