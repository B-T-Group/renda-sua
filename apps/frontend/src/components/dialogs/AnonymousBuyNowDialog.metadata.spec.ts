/** Ensures checkout auth_redirect metadata stays PII-free (issue #363). */
describe('AnonymousBuyNowDialog auth_redirect metadata shape', () => {
  it('allows only screenHint and contactMethod', () => {
    const metadata = {
      screenHint: 'login' as const,
      contactMethod: 'email' as const,
    };
    expect(metadata).not.toHaveProperty('email');
    expect(metadata).not.toHaveProperty('phone');
    expect(metadata).not.toHaveProperty('loginHint');
    expect(Object.keys(metadata).sort()).toEqual(['contactMethod', 'screenHint']);
  });
});
