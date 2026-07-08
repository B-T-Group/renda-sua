import {
  canTransitionContractStatus,
  mapBoldSignEventToStatus,
} from './business-contract-status.util';

describe('business-contract-status.util', () => {
  it('maps BoldSign events to contract statuses', () => {
    expect(mapBoldSignEventToStatus('Completed')).toBe('signed');
    expect(mapBoldSignEventToStatus('Viewed')).toBe('viewed');
    expect(mapBoldSignEventToStatus('Reminder')).toBeNull();
  });

  it('allows valid transitions', () => {
    expect(canTransitionContractStatus('sent', 'viewed')).toBe(true);
    expect(canTransitionContractStatus('viewed', 'signed')).toBe(true);
    expect(canTransitionContractStatus('signed', 'viewed')).toBe(false);
  });
});
