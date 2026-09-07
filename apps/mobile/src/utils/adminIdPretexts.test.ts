import {
  ADMIN_BUSINESS_ID_FILTERS,
  ADMIN_BUSINESS_LIFECYCLE_FILTERS,
  reminderPretextsForIdStatus,
} from './adminIdPretexts';

describe('adminIdPretexts', () => {
  it('exposes journey-ordered lifecycle filters', () => {
    expect([...ADMIN_BUSINESS_LIFECYCLE_FILTERS]).toEqual([
      '',
      'created',
      'contract_signed',
      'active',
      'suspended',
    ]);
  });

  it('includes not_approved in ID filters', () => {
    expect(ADMIN_BUSINESS_ID_FILTERS).toContain('not_approved');
    expect(ADMIN_BUSINESS_ID_FILTERS[1]).toBe('not_approved');
  });

  it('returns Missing ID reminder only when status is missing', () => {
    const keys = reminderPretextsForIdStatus('missing').map((p) => p.key);
    expect(keys).toEqual(['missingId']);
  });

  it('returns Re-upload reminder only when status is rejected', () => {
    const keys = reminderPretextsForIdStatus('rejected').map((p) => p.key);
    expect(keys).toEqual(['reuploadId']);
  });

  it('returns no reminders for pending or approved', () => {
    expect(reminderPretextsForIdStatus('pending')).toEqual([]);
    expect(reminderPretextsForIdStatus('approved')).toEqual([]);
    expect(reminderPretextsForIdStatus(undefined)).toEqual([]);
  });
});
