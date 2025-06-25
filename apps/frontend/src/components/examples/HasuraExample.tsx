import React from 'react';
import { ApolloProvider, gql, useQuery } from '@apollo/client';
import { Box, Typography, Card, CardContent, CircularProgress, Alert } from '@mui/material';
import { useHasuraClient } from '../../hooks';

// Example GraphQL query
const GET_USER_TYPES = gql`
  query GetUserTypes {
    user_types {
      id
      name
      description
    }
  }
`;

const UserTypesList = () => {
  const { loading, error, data } = useQuery(GET_USER_TYPES);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Error loading user types: {error.message}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        User Types from Hasura
      </Typography>
      {data?.user_types?.map((userType: any) => (
        <Card key={userType.id} sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" component="h3">
              {userType.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {userType.description}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

const HasuraExample: React.FC = () => {
  const hasuraClient = useHasuraClient();

  if (!hasuraClient) {
    return (
      <Box p={4}>
        <Typography variant="h6" color="text.secondary">
          Please log in to access Hasura data
        </Typography>
      </Box>
    );
  }

  return (
    <ApolloProvider client={hasuraClient}>
      <Box p={4}>
        <Typography variant="h4" gutterBottom>
          Hasura GraphQL Example
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          This component demonstrates how to use the Hasura client to fetch data from your GraphQL API.
        </Typography>
        <UserTypesList />
      </Box>
    </ApolloProvider>
  );
};

export default HasuraExample; 