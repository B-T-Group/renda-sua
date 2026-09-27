import {
  actionableAcceptanceCountQuery,
  mapPendingAcceptance,
  PENDING_ACCEPTANCE_QUEUE_LIMIT,
  pendingAcceptanceQuery,
} from './pending-acceptance.query';

describe('pendingAcceptanceQuery', () => {
  it('returns the oldest order plus an id queue', () => {
    const query = pendingAcceptanceQuery(false);
    expect(query).toContain('order_by: { created_at: asc }');
    expect(query).toContain('queue: orders');
    expect(query).toContain(`limit: ${PENDING_ACCEPTANCE_QUEUE_LIMIT}`);
    expect(query).not.toContain('$lid');
  });

  it('excludes busy-snoozed orders from the digest count', () => {
    const query = actionableAcceptanceCountQuery();
    expect(query).toContain('$snoozeCutoff: timestamptz!');
    expect(query).toContain('busy_extra_prep_minutes: { _gt: 0 }');
    expect(query).toContain('updated_at: { _gte: $snoozeCutoff }');
    expect(query).not.toContain('$lid');
  });

  it('scopes the location query to one shop', () => {
    const query = pendingAcceptanceQuery(true);
    expect(query).toContain('business_location_id: { _eq: $lid }');
    expect(query).toContain('$lid: uuid!');
  });

  it('maps the head order and keeps queue ids', () => {
    const order = { id: 'a' } as never;
    expect(
      mapPendingAcceptance({
        orders: [order],
        queue: [{ id: 'a' }, { id: 'b' }],
      })
    ).toEqual({
      active: true,
      order,
      queue: [{ id: 'a' }, { id: 'b' }],
    });
  });

  it('returns an empty queue when nothing is pending', () => {
    expect(mapPendingAcceptance({ orders: [], queue: [] })).toEqual({
      active: false,
      order: null,
      queue: [],
    });
  });
});
