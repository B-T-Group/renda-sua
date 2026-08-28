import { escalationRepliesForRole } from './adminOrderEscalationReplies';

describe('escalationRepliesForRole', () => {
  it('returns three business templates', () => {
    expect(escalationRepliesForRole('business').map((r) => r.id)).toEqual([
      'business_confirm',
      'business_window',
      'business_support',
    ]);
  });

  it('returns three client templates', () => {
    expect(escalationRepliesForRole('client').map((r) => r.id)).toEqual([
      'client_patience',
      'client_followup',
      'client_processing',
    ]);
  });

  it('returns none for agent', () => {
    expect(escalationRepliesForRole('agent')).toEqual([]);
  });
});
