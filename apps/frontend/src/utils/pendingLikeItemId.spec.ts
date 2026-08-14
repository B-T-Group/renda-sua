import {
  clearPendingLikeItemId,
  consumePendingLikeItemId,
  peekPendingLikeItemId,
  setPendingLikeItemId,
} from './pendingLikeItemId';

describe('pendingLikeItemId', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-14T10:00:00.000Z'));
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => store.clear(),
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores and peeks a pending like', () => {
    setPendingLikeItemId('item-1');
    expect(peekPendingLikeItemId()).toBe('item-1');
  });

  it('expires pending likes after 30 minutes', () => {
    setPendingLikeItemId('item-1');
    jest.setSystemTime(new Date('2026-08-14T10:30:01.000Z'));
    expect(peekPendingLikeItemId()).toBeNull();
    expect(store.size).toBe(0);
  });

  it('consumes a pending like once', () => {
    setPendingLikeItemId('item-1');
    expect(consumePendingLikeItemId()).toBe('item-1');
    expect(consumePendingLikeItemId()).toBeNull();
    expect(peekPendingLikeItemId()).toBeNull();
  });

  it('clears without returning the id', () => {
    setPendingLikeItemId('item-1');
    clearPendingLikeItemId();
    expect(peekPendingLikeItemId()).toBeNull();
  });

  it('treats blank stored ids as empty', () => {
    store.set('rs_pending_like_item_id', '   ');
    store.set('rs_pending_like_at', String(Date.now()));
    expect(peekPendingLikeItemId()).toBeNull();
  });
});
