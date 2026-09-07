import { parseRecipientList } from './useRecipients';

describe('parseRecipientList', () => {
  it('accepts a raw array from the Nest list endpoint', () => {
    const rows = [{ id: '1', name: 'Ada' }];
    expect(parseRecipientList(rows)).toEqual(rows);
  });

  it('accepts a wrapped { recipients } payload', () => {
    const rows = [{ id: '1', name: 'Ada' }];
    expect(parseRecipientList({ recipients: rows })).toEqual(rows);
  });

  it('returns an empty list for unknown payloads', () => {
    expect(parseRecipientList(null)).toEqual([]);
    expect(parseRecipientList({ success: true })).toEqual([]);
  });
});
