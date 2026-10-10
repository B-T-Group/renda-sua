import {
  handoffOpenCleanupPending,
  isAiCleanupRunning,
  releaseFinishedCleanupPending,
} from './aiCleanupInProgress';

describe('isAiCleanupRunning', () => {
  it('is true when the server already has an open ai cleanup', () => {
    expect(
      isAiCleanupRunning({ id: 'img-1', open_cleanup_kinds: ['ai'] })
    ).toBe(true);
  });

  it('is true for a cleanup this screen just started', () => {
    expect(
      isAiCleanupRunning({ id: 'img-1', open_cleanup_kinds: [] }, new Set(['img-1']))
    ).toBe(true);
  });

  it('is false when rembg is open and ai is not', () => {
    expect(
      isAiCleanupRunning({ id: 'img-1', open_cleanup_kinds: ['rembg'] })
    ).toBe(false);
  });
});

describe('cleanup pending ids', () => {
  const pending = new Set(['img-1', 'img-2']);

  it('drops a pending id only after the server reports ai is open', () => {
    const next = handoffOpenCleanupPending(pending, [
      { id: 'img-1', open_cleanup_kinds: ['ai'] },
      { id: 'img-2', open_cleanup_kinds: [] },
    ]);
    expect([...next]).toEqual(['img-2']);
  });

  it('drops a pending id when a finished refresh shows ai is not open', () => {
    const next = releaseFinishedCleanupPending(pending, [
      { id: 'img-1', open_cleanup_kinds: [] },
      { id: 'img-2', open_cleanup_kinds: ['ai'] },
    ]);
    expect([...next]).toEqual(['img-2']);
  });
});
