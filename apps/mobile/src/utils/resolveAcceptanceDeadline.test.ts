import { describe, expect, it } from 'vitest';
import { resolveAcceptanceDeadline } from './resolveAcceptanceDeadline';

describe('resolveAcceptanceDeadline', () => {
  const future = '2099-01-01T12:00:00.000Z';
  const past = '2000-01-01T12:00:00.000Z';

  it('hides timer for scheduled / non-SLA states', () => {
    expect(
      resolveAcceptanceDeadline({
        acceptance_state: 'scheduled',
        acceptance_deadline_at: future,
      })
    ).toBeNull();
    expect(
      resolveAcceptanceDeadline({
        acceptance_state: null,
        acceptance_deadline_at: future,
      })
    ).toBeNull();
  });

  it('shows timer only for active SLA with a future deadline', () => {
    expect(
      resolveAcceptanceDeadline({
        acceptance_state: 'awaiting_acceptance',
        acceptance_deadline_at: future,
      })
    ).toBe(future);
  });

  it('hides timer when deadline already passed', () => {
    expect(
      resolveAcceptanceDeadline({
        acceptance_state: 'awaiting_acceptance',
        acceptance_deadline_at: past,
      })
    ).toBeNull();
  });
});
