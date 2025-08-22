import { ApolloProvider as BaseApolloProvider } from '@apollo/client';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import React, { useEffect } from 'react';
import { useGraphQLSubscription } from '../hooks/useGraphQLSubscription';

interface ApolloProviderProps {
  children: React.ReactNode;
}

export const ApolloProvider: React.FC<ApolloProviderProps> = ({ children }) => {
  const { client, isLoading, error } = useGraphQLSubscription();

  // Debug logging
  useEffect(() => {
    console.log('ApolloProvider state:', {
      client: !!client,
      isLoading,
      error,
    });
  }, [client, isLoading, error]);

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
