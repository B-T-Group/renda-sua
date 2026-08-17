(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

expect.extend({
  toBeInTheDocument(received: Element | null) {
    const pass = received != null && document.body.contains(received);
    return {
      pass,
      message: () =>
        pass
          ? 'expected element not to be in the document'
          : 'expected element to be in the document',
    };
  },
});

jest.mock('@auth0/auth0-react', () => ({
  Auth0Provider: ({ children }: { children: unknown }) => children,
  useAuth0: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { sub: 'auth0|test-user', email: 'test@example.com' },
    getAccessTokenSilently: jest.fn().mockResolvedValue('test-token'),
    loginWithRedirect: jest.fn(),
    logout: jest.fn(),
  }),
}));

jest.mock('./contexts/SessionAuthContext', () => ({
  SessionAuthProvider: ({ children }: { children: unknown }) => children,
  useSessionAuth: () => ({
    isAuthenticated: true,
    user: { sub: 'auth0|test-user', email: 'test@example.com' },
    getAccessToken: jest.fn().mockResolvedValue('test-token'),
    logout: jest.fn().mockResolvedValue(undefined),
    setPasswordlessSession: jest.fn(),
    clearPasswordlessSession: jest.fn(),
  }),
}));
