import { resolveReorderCartAction } from './reorderCart';

describe('resolveReorderCartAction', () => {
  it('returns replace for empty cart', () => {
    expect(resolveReorderCartAction([], 'biz-1')).toBe('replace');
  });

  it('returns add when cart is same business only', () => {
    expect(resolveReorderCartAction(['biz-1'], 'biz-1')).toBe('add');
  });

  it('blocks when cart has another business', () => {
    expect(resolveReorderCartAction(['biz-2'], 'biz-1')).toBe(
      'blocked_other_store'
    );
  });
});
