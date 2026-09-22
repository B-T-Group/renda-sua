import {
  formatSkippedNames,
  resolveReorderCartAction,
} from './reorderCart';

describe('resolveReorderCartAction', () => {
  it('returns replace for empty cart', () => {
    expect(resolveReorderCartAction([], 'biz-1')).toBe('replace');
  });

  it('returns add when same business', () => {
    expect(resolveReorderCartAction(['biz-1'], 'biz-1')).toBe('add');
  });

  it('blocks other store', () => {
    expect(resolveReorderCartAction(['biz-2'], 'biz-1')).toBe(
      'blocked_other_store'
    );
  });
});

describe('formatSkippedNames', () => {
  it('formats more than two names', () => {
    expect(
      formatSkippedNames(['A', 'B', 'C', 'D'], (n) => `and ${n} more`)
    ).toBe('A, B and 2 more');
  });
});
