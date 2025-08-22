import { ApolloProvider as BaseApolloProvider } from '@apollo/client';
import { useAuth0 } from '@auth0/auth0-react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import React, { useEffect } from 'react';
import { useGraphQLSubscription } from '../hooks/useGraphQLSubscription';

interface ApolloProviderProps {
  children: React.ReactNode;
}

export const ApolloProvider: React.FC<ApolloProviderProps> = ({ children }) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const { client, isLoading, error } = useGraphQLSubscription();

  // Debug logging
  useEffect(() => {
    console.log('ApolloProvider state:', {
      isAuthenticated,
      authLoading,
      client: !!client,
      isLoading,
      error,
    });
  }, [isAuthenticated, authLoading, client, isLoading, error]);

  // Show loading while Auth0 is initializing
  if (authLoading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="200px"
        gap={2}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Initializing authentication...
        </Typography>
      </Box>
    );
  }

  // If user is not authenticated, don't show error, just render children
  // The individual components will handle their own authentication states
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  // Show loading while GraphQL client is initializing
  if (isLoading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="200px"
        gap={2}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Initializing GraphQL Client...
        </Typography>
      </Box>
    );
  }

  // Only show error if user is authenticated but client failed to initialize
  if (error || !client) {
    return (
      <Box p={2}>
        <Alert severity="error">
          <Typography variant="body2">
            Failed to initialize GraphQL Client: {error || 'Unknown error'}
          </Typography>
          <Typography variant="caption" display="block" mt={1}>
            Please refresh the page or check your connection.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return <BaseApolloProvider client={client}>{children}</BaseApolloProvider>;
};

export default ApolloProvider;
