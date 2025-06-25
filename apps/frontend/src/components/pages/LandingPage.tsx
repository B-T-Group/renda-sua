import React from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Paper,
} from '@mui/material';
import {
  Security,
  Speed,
  Analytics,
  ArrowForward,
} from '@mui/icons-material';
import { useAuth0 } from '@auth0/auth0-react';
import Logo from '../common/Logo';

const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth0();

  const features = [
    {
      icon: <Security color="primary" sx={{ fontSize: 40 }} />,
      title: 'Secure Authentication',
      description: 'Enterprise-grade security with Auth0 integration',
    },
    {
      icon: <Speed color="primary" sx={{ fontSize: 40 }} />,
      title: 'Fast Performance',
      description: 'Optimized for speed and reliability',
    },
    {
      icon: <Analytics color="primary" sx={{ fontSize: 40 }} />,
      title: 'Advanced Analytics',
      description: 'Comprehensive insights and reporting',
    },
  ];

  return (
    <Box>
      {/* Hero Section */}
      <Paper
        sx={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
          color: 'white',
          py: 8,
          mb: 6,
        }}
      >
        <Container maxWidth="lg">
          <Box textAlign="center">
            <Logo variant="default" color="white" size="large" />
            <Typography
              variant="h2"
              component="h1"
              gutterBottom
              sx={{ mt: 4, fontWeight: 700 }}
            >
              Welcome to Rendasua
            </Typography>
            <Typography
              variant="h5"
              component="h2"
              sx={{ mb: 4, opacity: 0.9, maxWidth: 600, mx: 'auto' }}
            >
              Your comprehensive solution for modern business management
            </Typography>
            {!isAuthenticated && (
              <Button
                variant="contained"
                size="large"
                sx={{
                  bgcolor: 'white',
                  color: 'primary.main',
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  '&:hover': {
                    bgcolor: 'grey.100',
                  },
                }}
                endIcon={<ArrowForward />}
              >
                Get Started
              </Button>
            )}
          </Box>
        </Container>
      </Paper>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ mb: 8 }}>
        <Typography
          variant="h3"
          component="h2"
          textAlign="center"
          gutterBottom
          sx={{ mb: 6 }}
        >
          Why Choose Rendasua?
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(3, 1fr)',
            },
            gap: 4,
          }}
        >
          {features.map((feature, index) => (
            <Card
              key={index}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                textAlign: 'center',
                p: 3,
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ mb: 2 }}>{feature.icon}</Box>
                <Typography
                  variant="h5"
                  component="h3"
                  gutterBottom
                  fontWeight={600}
                >
                  {feature.title}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {feature.description}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'center' }}>
                <Button size="small" endIcon={<ArrowForward />}>
                  Learn More
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      </Container>

      {/* CTA Section */}
      {!isAuthenticated && (
        <Paper
          sx={{
            bgcolor: 'grey.50',
            py: 6,
            textAlign: 'center',
          }}
        >
          <Container maxWidth="md">
            <Typography variant="h4" component="h2" gutterBottom>
              Ready to Get Started?
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Join thousands of users who trust Rendasua for their business needs
            </Typography>
            <Button
              variant="contained"
              size="large"
              sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
              endIcon={<ArrowForward />}
            >
              Sign Up Now
            </Button>
          </Container>
        </Paper>
      )}
    </Box>
  );
};

export default LandingPage; 