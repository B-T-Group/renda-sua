import { Error as ErrorIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Typography,
} from '@mui/material';
import React from 'react';

interface ErrorPageProps {
  error: string;
  onRetry?: () => void;
}

const ErrorPage: React.FC<ErrorPageProps> = ({ error, onRetry }) => {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <ErrorIcon color="error" sx={{ fontSize: 64, mb: 2 }} />

        <Typography variant="h4" component="h1" gutterBottom color="error">
          Something went wrong
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          We encountered an error while loading your profile.
        </Typography>

        <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
          <Typography variant="body2">{error}</Typography>
        </Alert>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          {onRetry && (
            <Button variant="contained" onClick={onRetry} size="large">
              Try Again
            </Button>
          )}

          <Button
            variant="outlined"
            onClick={() => window.location.reload()}
            size="large"
          >
            Refresh Page
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          If the problem persists, please contact support.
        </Typography>
      </Paper>
    </Container>
  );
};

export default ErrorPage;
