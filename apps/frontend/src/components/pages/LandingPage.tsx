import { useAuth0 } from '@auth0/auth0-react';
import {
  ArrowForward,
  LocalShipping,
  LocationOn,
  Security,
  Speed,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Container,
  Grid,
  Paper,
  Typography,
} from '@mui/material';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useSEO } from '../../hooks/useSEO';
import Logo from '../common/Logo';
import { SEOHead } from '../seo';

const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth0();

  // Note: No automatic redirect on load - users should click login/dashboard button
  // Authenticated users will be redirected to dashboard only after explicit login via /app route

  // SEO configuration for landing page
  const seoConfig = useSEO({
    title: 'Rendasua - Fast & Reliable Delivery Service',
    description:
      'Connect with trusted delivery agents and get your packages delivered safely and on time, every time. Same-day delivery available with real-time tracking.',
    keywords:
      'delivery service, same-day delivery, package delivery, delivery agents, real-time tracking, secure delivery, Rendasua',
    type: 'website',
  });

  const features = [
    {
      icon: <LocalShipping sx={{ fontSize: 48 }} />,
      title: 'Fast Delivery',
      description:
        'Quick and reliable delivery service to get your items where they need to be',
    },
    {
      icon: <Speed sx={{ fontSize: 48 }} />,
      title: 'Real-time Tracking',
      description:
        'Track your deliveries in real-time with live updates and notifications',
    },
    {
      icon: <LocationOn sx={{ fontSize: 48 }} />,
      title: 'Wide Coverage',
      description:
        'Serving multiple neighborhoods with our growing delivery network',
    },
    {
      icon: <Security sx={{ fontSize: 48 }} />,
      title: 'Secure Handling',
      description:
        'Your items are handled with care by professional delivery agents',
    },
  ];

  return (
    <Box sx={{ overflow: 'hidden' }}>
      <SEOHead {...seoConfig} />
      {/* Hero Section */}
      <Paper
        sx={{
          background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
          color: 'white',
          py: { xs: 6, md: 12 },
          mb: 8,
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            opacity: 0.3,
          },
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Box textAlign="center">
            <Logo variant="with-tagline" color="white" size="large" />
            <Typography
              variant="h1"
              component="h1"
              gutterBottom
              sx={{
                mt: 4,
                fontWeight: 800,
                fontSize: { xs: '2.5rem', md: '4rem' },
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                color: 'white',
              }}
            >
              Fast & Reliable
              <br />
              <Box component="span" sx={{ color: 'white' }}>
                Delivery Service
              </Box>
            </Typography>
            <Typography
              variant="h5"
              component="h2"
              sx={{
                mb: 5,
                color: 'rgba(255, 255, 255, 0.9)',
                maxWidth: 600,
                mx: 'auto',
                fontWeight: 400,
                lineHeight: 1.5,
              }}
            >
              Connect with trusted delivery agents and get your items delivered
              safely and on time
            </Typography>

            {/* Browse Items Button */}
            <Button
              variant="contained"
              size="large"
              component={RouterLink}
              to="/items"
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                px: 6,
                py: 2,
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: 2,
                textTransform: 'none',
                boxShadow: '0 4px 16px rgba(255, 255, 255, 0.3)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  bgcolor: 'grey.100',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 24px rgba(255, 255, 255, 0.4)',
                },
              }}
              endIcon={<ArrowForward />}
            >
              Browse Items
            </Button>
          </Box>
        </Container>
      </Paper>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Box textAlign="center" sx={{ mb: 6 }}>
          <Typography
            variant="h3"
            component="h2"
            gutterBottom
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1.75rem', md: '2.5rem' },
            }}
          >
            Why Choose Renda Sua?
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            A reliable platform connecting you with professional delivery
            services
          </Typography>
        </Box>
        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
              <Box
                sx={{
                  textAlign: 'center',
                  p: 3,
                }}
              >
                <Avatar
                  sx={{
                    width: 64,
                    height: 64,
                    mx: 'auto',
                    mb: 2,
                    bgcolor: 'primary.main',
                    color: 'white',
                  }}
                >
                  {feature.icon}
                </Avatar>
                <Typography
                  variant="h6"
                  component="h3"
                  gutterBottom
                  sx={{ fontWeight: 600, mb: 1 }}
                >
                  {feature.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    lineHeight: 1.6,
                  }}
                >
                  {feature.description}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA Section */}
      {!isAuthenticated && (
        <Paper
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            py: 6,
            textAlign: 'center',
          }}
        >
          <Container maxWidth="md">
            <Typography
              variant="h4"
              component="h2"
              gutterBottom
              sx={{
                fontWeight: 700,
                mb: 2,
              }}
            >
              Ready to Get Started?
            </Typography>
            <Typography
              variant="body1"
              sx={{
                mb: 4,
                opacity: 0.95,
              }}
            >
              Join our platform today and experience reliable delivery services
            </Typography>
            <Button
              variant="contained"
              size="large"
              component={RouterLink}
              to="/items"
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                px: 5,
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 2,
                textTransform: 'none',
                '&:hover': {
                  bgcolor: 'grey.100',
                },
              }}
              endIcon={<ArrowForward />}
            >
              Get Started
            </Button>
          </Container>
        </Paper>
      )}
    </Box>
  );
};

export default LandingPage;
