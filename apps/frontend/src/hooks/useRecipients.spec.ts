import { parseRecipientList } from './useRecipients';

describe('parseRecipientList', () => {
  it('accepts a raw array from the Nest list endpoint', () => {
    const rows = [{ id: '1', name: 'Ada', address_id: null }];
    expect(parseRecipientList(rows)).toEqual(rows);
  });

  it('accepts a wrapped { recipients } payload', () => {
    const rows = [{ id: '1', name: 'Ada', address_id: 'addr-1' }];
    expect(parseRecipientList({ recipients: rows })).toEqual(rows);
  });

  it('normalizes missing address_id to null', () => {
    expect(parseRecipientList([{ id: '1', name: 'Ada' }])).toEqual([
      { id: '1', name: 'Ada', address_id: null },
    ]);
  });

  it('returns an empty list for unknown payloads', () => {
    expect(parseRecipientList(null)).toEqual([]);
    expect(parseRecipientList({ success: true })).toEqual([]);
  });
});
