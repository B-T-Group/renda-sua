import {
  isRetryableAssignmentError,
  orderAssignmentsForLocking,
} from './dedicated-assignment-locking.util';

describe('orderAssignmentsForLocking (QA L4)', () => {
  it('sorts by agent_id, case-insensitively, keeping input order for the same agent', () => {
    const rows = [
      { agent_id: 'C0000000-0000-0000-0000-000000000000', slot_key: 'morning' },
      { agent_id: 'a0000000-0000-0000-0000-000000000000', slot_key: 'evening' },
      { agent_id: 'b0000000-0000-0000-0000-000000000000', slot_key: 'morning' },
      { agent_id: 'a0000000-0000-0000-0000-000000000000', slot_key: 'afternoon' },
    ];
    expect(orderAssignmentsForLocking(rows).map((r) => `${r.agent_id[0].toLowerCase()}:${r.slot_key}`)).toEqual([
      'a:evening',
      'a:afternoon',
      'b:morning',
      'c:morning',
    ]);
    expect(rows[0].agent_id[0]).toBe('C');
  });

  it('two writers with the same agents in opposite orders lock in the same order', () => {
    const x = { agent_id: '11111111-0000-0000-0000-000000000000' };
    const y = { agent_id: 'ffffffff-0000-0000-0000-000000000000' };
    expect(orderAssignmentsForLocking([y, x])).toEqual(orderAssignmentsForLocking([x, y]));
  });
});

describe('isRetryableAssignmentError', () => {
  it.each([
    [{ code: '40P01' }, true],
    [{ extensions: { internal: { error: { status_code: '40P01' } } } }, true],
    [{ response: { errors: [{ message: 'database query error', extensions: { internal: { error: { status_code: '40P01' } } } }] } }, true],
    [{ message: 'deadlock detected' }, true],
    [{ code: '23514', message: 'dedicated_agent_assignment_cap_exceeded: ...' }, false],
    [{ message: 'dedicated_agent_assignment_requires_read_committed' }, false],
    [null, false],
  ])('%j -> %s', (err, expected) => {
    expect(isRetryableAssignmentError(err)).toBe(expected);
  });
});

describe('isRetryableAssignmentError (QA #613 N4)', () => {
  it('retries a serialization failure surfaced only as a message (Hasura drops the SQLSTATE)', () => {
    expect(isRetryableAssignmentError(new Error('could not serialize access due to concurrent update'))).toBe(true);
  });
  it('does not retry unrelated errors', () => {
    expect(isRetryableAssignmentError(new Error('unique violation'))).toBe(false);
  });
});
