import { formatAgentOrderUrgencyDisplay } from './agentOrderUrgencyCopy';

const t = (key: string, defaultValue: string, options?: Record<string, unknown>) => {
  let out = defaultValue;
  if (!options) return out;
  for (const [name, value] of Object.entries(options)) {
    out = out.replace(new RegExp(`{{${name}}}`, 'g'), String(value));
  }
  return out;
};

describe('formatAgentOrderUrgencyDisplay', () => {
  const now = new Date('2026-10-31T15:00:00Z');

  it('returns the pickup-by / deliver-by label when on time', () => {
    expect(
      formatAgentOrderUrgencyDisplay(
        {
          deadlineAt: '2026-10-31T16:00:00Z',
          label: 'Pick up by 4:00 PM',
          overdue: false,
        },
        now,
        t
      )
    ).toEqual({ text: 'Pick up by 4:00 PM', overdue: false });
  });

  it('uses Late by {duration} when overdue', () => {
    expect(
      formatAgentOrderUrgencyDisplay(
        {
          deadlineAt: '2026-10-31T14:15:00Z',
          label: 'Pick up by 2:15 PM',
          overdue: true,
        },
        now,
        t
      )
    ).toEqual({ text: 'Late by 45m', overdue: true });
  });

  it('omits the line when deliveryUrgency has no deadline', () => {
    expect(formatAgentOrderUrgencyDisplay(null, now, t)).toBeNull();
    expect(
      formatAgentOrderUrgencyDisplay(
        { deadlineAt: null, label: 'Pick up by', overdue: false },
        now,
        t
      )
    ).toBeNull();
  });
});
