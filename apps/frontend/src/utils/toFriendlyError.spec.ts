import { toFriendlyError } from './toFriendlyError';

describe('toFriendlyError', () => {
  const fallback = 'Something went wrong while loading your orders.';

  it('hides technical failures', () => {
    expect(toFriendlyError(new Error('GraphQL error: 500'), fallback)).toBe(fallback);
  });

  it('keeps a short human message', () => {
    expect(toFriendlyError(new Error('This store is closed'), fallback)).toBe('This store is closed');
  });
});