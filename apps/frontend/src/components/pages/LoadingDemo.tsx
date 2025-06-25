import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Paper,
} from '@mui/material';
import { PlayArrow } from '@mui/icons-material';
import LoadingPage from '../common/LoadingPage';
import LoadingSpinner from '../common/LoadingSpinner';

const LoadingDemo: React.FC = () => {
  const [showFullPage, setShowFullPage] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);

  const handleShowFullPage = () => {
    setShowFullPage(true);
    setTimeout(() => setShowFullPage(false), 3000);
  };

  const handleShowSpinner = () => {
    setShowSpinner(true);
    setTimeout(() => setShowSpinner(false), 2000);
  };

  if (showFullPage) {
    return (
      <LoadingPage
        message="Demo Loading Page"
        subtitle="This is a full-page loading experience"
        showProgress={true}
      />
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Loading Components Demo
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Explore the different loading components available in the Rendasua application.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, 1fr)',
          },
          gap: 3,
          mb: 3,
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Full Page Loading
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              A complete loading experience with the Rendasua branding, animations, and progress indicator.
            </Typography>
            <Button
              variant="contained"
              startIcon={<PlayArrow />}
              onClick={handleShowFullPage}
              disabled={showFullPage}
            >
              Show Full Page Loading
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Loading Spinner
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              A compact loading spinner for smaller loading states within components.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<PlayArrow />}
              onClick={handleShowSpinner}
              disabled={showSpinner}
            >
              Show Spinner
            </Button>
          </CardContent>
        </Card>
      </Box>

      <Paper sx={{ p: 3, minHeight: 200, position: 'relative' }}>
        <Typography variant="h6" gutterBottom>
          Spinner Examples
        </Typography>
        
        {showSpinner ? (
          <LoadingSpinner
            message="Loading data..."
            size="large"
            fullHeight={false}
          />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(3, 1fr)',
              },
              gap: 2,
            }}
          >
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <LoadingSpinner size="small" message="Small" />
            </Box>
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <LoadingSpinner size="medium" message="Medium" />
            </Box>
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <LoadingSpinner size="large" message="Large" />
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default LoadingDemo; 