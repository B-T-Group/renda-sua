/**
 * Client Apollo Rendasua Agent – Hasura GraphQL avec Bearer token.
 * URI résolue à chaque requête via `getHasuraGraphqlUri()` (respecte le choix dev/prod persisté).
 */

import {
  ApolloClient,
  ApolloLink,
  createHttpLink,
  DefaultOptions,
  InMemoryCache,
  split,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { fromError, fromPromise } from '@apollo/client/link/utils';
import { getMainDefinition } from '@apollo/client/utilities';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from 'graphql-ws';
import { getHasuraGraphqlUri } from '../config/auth0';
import { registerEnvChangeListener } from '../config/envSwitch';
import Auth0DirectService from './auth0DirectService';

const TOKENS_KEY = '@RendasuaAgent:tokens';
const EXPIRATION_BUFFER = 5 * 60 * 1000;

const httpLink = createHttpLink({
  uri: 'https://hasura.rendasua.com/v1/graphql',
  useGETForQueries: false,
  fetch: (_input, init) =>
    fetch(getHasuraGraphqlUri(), {
      ...init,
      method: 'POST',
    }),
});

const authLink = setContext(async (_, { headers }) => {
  try {
    const raw = await AsyncStorage.getItem(TOKENS_KEY);
    if (!raw) return { headers };

    const tokens = JSON.parse(raw);
    const now = Date.now();
    const expiringSoon = tokens.expiresAt && now >= tokens.expiresAt - EXPIRATION_BUFFER;

    if (expiringSoon) {
      const Auth0 = (await import('./auth0DirectService')).default;
      const refreshed = await Auth0.refreshAccessToken();
      if (refreshed?.access_token) {
        const updated = await AsyncStorage.getItem(TOKENS_KEY);
        const t = updated ? JSON.parse(updated) : null;
        const accessToken = t?.accessToken ?? refreshed.access_token;
        return {
          headers: {
            ...headers,
            Authorization: `Bearer ${accessToken}`,
          },
        };
      }
    }

    if (tokens.accessToken) {
      return {
        headers: {
          ...headers,
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      };
    }
  } catch {
    /* ignore */
  }
  return { headers };
});

/**
 * On a 401/403, refresh the access token and *retry the same request* with
 * the new Bearer header instead of just firing a refresh and letting the
 * original request fail. Without this, a token that expires mid-session
 * surfaces as a user-visible error even though the refresh itself succeeds.
 *
 * Retries at most once per operation (tracked via `authRetried` in the
 * operation context) — otherwise an operation that keeps 401ing (e.g. a
 * genuinely dead refresh token) would re-enter this handler forever,
 * hammering Auth0 and the API on every retry.
 */
const errorLink = onError(({ networkError, operation, forward }) => {
  if (networkError) {
    const status = (networkError as { statusCode?: number; status?: number }).statusCode
      ?? (networkError as { status?: number }).status;
    const alreadyRetried = Boolean(operation.getContext().authRetried);
    if ((status === 401 || status === 403) && !alreadyRetried) {
      return fromPromise(Auth0DirectService.refreshAccessTokenDetailed()).flatMap((result) => {
        if (!result.ok) {
          return fromError(networkError);
        }
        operation.setContext(({ headers }: { headers?: Record<string, string> }) => ({
          headers: {
            ...headers,
            Authorization: `Bearer ${result.tokens.access_token}`,
          },
          authRetried: true,
        }));
        return forward(operation);
      });
    }
  }
  return forward(operation);
});

/** Hasura WebSocket endpoint for the active environment (http(s) -> ws(s)). */
function getHasuraWsUri(): string {
  return getHasuraGraphqlUri()
    .replace(/^http:\/\//, 'ws://')
    .replace(/^https:\/\//, 'wss://');
}

const wsLink = new GraphQLWsLink(
  createClient({
    url: getHasuraWsUri,
    connectionParams: async () => {
      try {
        const token = await Auth0DirectService.getAccessToken();
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      } catch {
        return {};
      }
    },
    retryAttempts: 5,
    retryWait: (retryCount) =>
      new Promise((resolve) =>
        setTimeout(resolve, Math.min(1000 * 2 ** retryCount, 10000))
      ),
  })
);

const httpChain = ApolloLink.from([errorLink, authLink, httpLink]);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpChain
);

const defaultOptions: DefaultOptions = {
  watchQuery: { fetchPolicy: 'cache-and-network', errorPolicy: 'ignore' },
  query: { fetchPolicy: 'cache-first', errorPolicy: 'all' },
};

let apolloClient: ApolloClient<unknown> | null = null;

export function getClient(): ApolloClient<unknown> {
  if (!apolloClient) {
    apolloClient = new ApolloClient({
      link: splitLink,
      cache: new InMemoryCache(),
      defaultOptions,
    });
  }
  return apolloClient;
}

registerEnvChangeListener(() => {
  void getClient().clearStore();
});

export const client = getClient();
