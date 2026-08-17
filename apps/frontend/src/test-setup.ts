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

Object.defineProperty(window, 'location', {
  value: new URL('https://localhost/'),
  writable: true,
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

jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn().mockResolvedValue({}),
  })),
  gql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce(
      (query, part, index) => `${query}${part}${values[index] ?? ''}`,
      ''
    ),
  ClientError: class ClientError extends Error {},
}));

jest.mock('./contexts/UserProfileContext', () => ({
  UserProfileProvider: ({ children }: { children: unknown }) => children,
  isLegacyWalletAccount: (account: { business_location_id?: string | null }) =>
    !account.business_location_id,
  useUserProfileContext: () => ({
    profile: null,
    loading: false,
    error: null,
    userType: 'client',
    personas: ['client'],
    delegations: [],
    activeContext: { type: 'persona', persona: 'client' },
    activeDelegation: null,
    isDelegationContext: false,
    needsPersonaSelection: false,
    needsContextSelection: false,
    setActivePersona: jest.fn().mockResolvedValue(undefined),
    setActiveContext: jest.fn().mockResolvedValue(undefined),
    isProfileComplete: true,
    successMessage: null,
    errorMessage: null,
    accounts: [],
    accountsLoading: false,
    accountsError: null,
    refetch: jest.fn().mockResolvedValue(undefined),
    refetchAccounts: jest.fn().mockResolvedValue(undefined),
    clearProfile: jest.fn(),
    updateBusinessAiTokens: jest.fn(),
    updateProfile: jest.fn().mockResolvedValue(true),
    updateProfilePicture: jest.fn().mockResolvedValue(true),
    addAddress: jest.fn().mockResolvedValue(true),
    updateAddress: jest.fn().mockResolvedValue(true),
    clearMessages: jest.fn(),
  }),
}));

jest.mock('./contexts/LoadingContext', () => ({
  LoadingProvider: ({ children }: { children: unknown }) => children,
  useLoading: () => ({
    isLoading: false,
    loadingMessage: '',
    showLoading: jest.fn(),
    hideLoading: jest.fn(),
    setLoadingMessage: jest.fn(),
  }),
}));

jest.mock('./contexts/CartContext', () => ({
  CartProvider: ({ children }: { children: unknown }) => children,
  useCart: () => ({
    cartItems: [],
    addToCart: jest.fn(),
    removeFromCart: jest.fn(),
    updateQuantity: jest.fn(),
    clearCart: jest.fn(),
    getCartItemCount: jest.fn().mockReturnValue(0),
    getCartByBusiness: jest.fn().mockReturnValue([]),
    getCartTotal: jest.fn().mockReturnValue(0),
    isItemInCart: jest.fn().mockReturnValue(false),
    isListingInCart: jest.fn().mockReturnValue(false),
    getListingQuantityInCart: jest.fn().mockReturnValue(0),
    getLineQuantityInCart: jest.fn().mockReturnValue(0),
  }),
}));

jest.mock('./hooks/useAccountSubscription', () => ({
  useAccountSubscription: () => ({
    account: null,
    loading: false,
    error: undefined,
  }),
}));
