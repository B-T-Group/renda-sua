import { rankOrderDetailActions } from './rankOrderDetailActions';

describe('rankOrderDetailActions', () => {
  it('returns empty when there are no actions', () => {
    expect(rankOrderDetailActions([])).toEqual({
      primary: null,
      companion: null,
      overflow: [],
    });
  });

  it('promotes cancel to companion and leaves the rest in overflow', () => {
    const ranked = rankOrderDetailActions(
      [
        {
          id: 'confirm',
          labelKey: 'a',
          defaultLabel: 'Confirm',
          preferred: true,
        },
        {
          id: 'cancel',
          labelKey: 'b',
          defaultLabel: 'Cancel',
          destructive: true,
        },
        { id: 'printLabel', labelKey: 'c', defaultLabel: 'Print' },
      ],
      'confirm'
    );
    expect(ranked.primary?.id).toBe('confirm');
    expect(ranked.companion?.id).toBe('cancel');
    expect(ranked.overflow.map((a) => a.id)).toEqual(['printLabel']);
  });

  it('uses the sole remaining action as companion', () => {
    const ranked = rankOrderDetailActions([
      { id: 'pay', labelKey: 'a', defaultLabel: 'Pay', preferred: true },
      { id: 'ask_if_ready', labelKey: 'b', defaultLabel: 'Ask' },
    ]);
    expect(ranked.companion?.id).toBe('ask_if_ready');
    expect(ranked.overflow).toEqual([]);
  });
});
