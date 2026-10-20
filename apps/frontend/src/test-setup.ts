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
  toBeDisabled(received: Element | null) {
    if (!received) {
      return {
        pass: false,
        message: () => 'expected element to be disabled but element was not found',
      };
    }
    const pass =
      received.hasAttribute('disabled') ||
      received.hasAttribute('aria-disabled') ||
      (received as HTMLButtonElement | HTMLInputElement).disabled === true;
    return {
      pass,
      message: () =>
        pass
          ? 'expected element not to be disabled'
          : 'expected element to be disabled',
    };
  },
  toBeEnabled(received: Element | null) {
    if (!received) {
      return {
        pass: false,
        message: () => 'expected element to be enabled but element was not found',
      };
    }
    const pass =
      !received.hasAttribute('disabled') &&
      received.getAttribute('aria-disabled') !== 'true' &&
      (received as HTMLButtonElement | HTMLInputElement).disabled !== true;
    return {
      pass,
      message: () =>
        pass
          ? 'expected element not to be enabled'
          : 'expected element to be enabled',
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

jest.mock('./contexts/AuthGateContext', () => ({
  AuthGateProvider: ({ children }: { children: unknown }) => children,
  useAuthGate: () => ({
    flagOn: false,
    requireAuth: jest.fn().mockResolvedValue(false),
    openGenericGate: jest.fn(),
  }),
}));

jest.mock('./contexts/SessionAuthContext', () => ({
  SessionAuthProvider: ({ children }: { children: unknown }) => children,
  useSessionAuth: () => ({
    isAuthenticated: true,
    isSessionReady: true,
    isLoading: false,
    user: { sub: 'auth0|test-user', email: 'test@example.com' },
    getAccessToken: jest.fn().mockResolvedValue('test-token'),
    logout: jest.fn().mockResolvedValue(undefined),
    setPasswordlessSession: jest.fn(),
    clearPasswordlessSession: jest.fn(),
  }),
}));
