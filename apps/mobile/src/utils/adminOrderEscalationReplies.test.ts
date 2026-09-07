import { describe, expect, it } from 'vitest';
import { escalationRepliesForRole } from './adminOrderEscalationReplies';

describe('escalationRepliesForRole', () => {
  it('returns three business templates', () => {
    const replies = escalationRepliesForRole('business');
    expect(replies).toHaveLength(3);
    expect(replies.map((r) => r.id)).toEqual([
      'business_confirm',
      'business_window',
      'business_support',
    ]);
  });

  it('returns three client templates', () => {
    const replies = escalationRepliesForRole('client');
    expect(replies).toHaveLength(3);
    expect(replies.map((r) => r.id)).toEqual([
      'client_patience',
      'client_followup',
      'client_processing',
    ]);
  });

  it('returns none for agent', () => {
    expect(escalationRepliesForRole('agent')).toEqual([]);
  });
});
