import { Box, Button, Card, CardContent, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLoading } from '../../contexts/LoadingContext';
import { useApiWithLoading } from '../../hooks/useApiWithLoading';

const LoadingDemo: React.FC = () => {
  const { t } = useTranslation();
  const { showLoading, hideLoading, setLoadingMessage } = useLoading();
  const { callWithLoading } = useApiWithLoading();

  const handleSimpleLoading = () => {
    showLoading('common.loadingData');
    setTimeout(() => {
      hideLoading();
    }, 3000);
  };

  const handleLoadingWithMessage = () => {
    showLoading('common.savingData');
    setTimeout(() => {
      setLoadingMessage('common.processingRequest');
      setTimeout(() => {
        hideLoading();
      }, 2000);
    }, 2000);
  };

  const handleApiCallLoading = async () => {
    await callWithLoading(async () => {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return { success: true };
    }, 'common.fetchingOrders');
  };

  const handleProgressLoading = async () => {
    const progressMessages = [
      'common.connectingToServer',
      'common.authenticating',
      'common.processingRequest',
      'common.loadingData',
    ];

    await callWithLoading(async () => {
      // Simulate multi-step process
      for (let i = 0; i < progressMessages.length; i++) {
        setLoadingMessage(progressMessages[i]);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      return { success: true };
    }, progressMessages[0]);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Loading System Demo
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        This page demonstrates the global loading system. Try the different
        buttons below to see various loading scenarios.
      </Typography>

      <Box
        sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 600 }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Simple Loading
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Shows a loading screen for 3 seconds with a simple message.
            </Typography>
            <Button variant="contained" onClick={handleSimpleLoading} fullWidth>
              Show Simple Loading
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Loading with Message Change
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Shows loading for 4 seconds total, changing the message after 2
              seconds.
            </Typography>
            <Button
              variant="contained"
              onClick={handleLoadingWithMessage}
              fullWidth
            >
              Show Loading with Message Change
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              API Call Loading
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Simulates an API call with automatic loading management.
            </Typography>
            <Button
              variant="contained"
              onClick={handleApiCallLoading}
              fullWidth
            >
              Simulate API Call
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Progress Loading
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Shows a multi-step process with changing progress messages.
            </Typography>
            <Button
              variant="contained"
              onClick={handleProgressLoading}
              fullWidth
            >
              Show Progress Loading
            </Button>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          How to Use
        </Typography>
        <Typography variant="body1" paragraph>
          The loading system is automatically integrated with:
        </Typography>
        <ul>
          <li>
            <Typography variant="body2">
              <strong>API Client:</strong> All HTTP requests automatically show
              loading
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              <strong>GraphQL Requests:</strong> All GraphQL queries and
              mutations show loading
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              <strong>Manual Control:</strong> Use the useLoading hook for
              custom loading scenarios
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              <strong>API with Loading:</strong> Use useApiWithLoading for more
              control over loading messages
            </Typography>
          </li>
        </ul>
      </Box>
    </Box>
  );
};

export default LoadingDemo;
