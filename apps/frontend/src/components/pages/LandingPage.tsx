import { useAuth0 } from '@auth0/auth0-react';
import {
  ArrowForward,
  CheckCircleOutline,
  LocalShipping,
  Security,
  Speed,
} from '@mui/icons-material';
import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useSEO } from '../../hooks/useSEO';
import Logo from '../common/Logo';
import { SEOHead } from '../seo';

const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth0();
  const theme = useTheme();

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
      icon: LocalShipping,
      title: 'Fast Delivery',
      description:
        'Get your items delivered quickly and reliably by trusted local agents',
    },
    {
      icon: Speed,
      title: 'Real-time Tracking',
      description:
        'Track your orders in real-time with instant updates at every step',
    },
    {
      icon: Security,
      title: 'Secure & Safe',
      description:
        'Your items are handled with care by verified professional agents',
    },
  ];

  const benefits = [
    'Same-day delivery available',
    'Verified and trusted agents',
    'Secure payment options',
    'Real-time order tracking',
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <SEOHead {...seoConfig} />

      {/* Hero Section - Modern & Clean */}
      <Box
        sx={{
          position: 'relative',
          bgcolor: 'primary.main',
          color: 'white',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.08) 0%, transparent 50%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            position: 'relative',
            py: { xs: 10, md: 16 },
            zIndex: 1,
          }}
        >
          <Grid container spacing={4} alignItems="center">
            {/* Left Column - Text Content */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Box
                sx={{
                  textAlign: { xs: 'center', md: 'left' },
                }}
              >
                {/* Logo */}
                <Box sx={{ mb: 4 }}>
                  <Logo variant="with-tagline" color="white" size="large" />
                </Box>

                {/* Headline */}
                <Typography
                  variant="h1"
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4rem' },
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                    mb: 3,
                    background:
                      'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.85) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Delivery Made Simple
                </Typography>

                {/* Subtitle */}
                <Typography
                  variant="h5"
                  sx={{
                    mb: 5,
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontWeight: 400,
                    lineHeight: 1.6,
                    fontSize: { xs: '1.1rem', md: '1.3rem' },
                  }}
                >
                  Connect with trusted agents and get your items delivered
                  safely, quickly, and reliably
                </Typography>

                {/* Benefits List - Enhanced Visibility */}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{
                    justifyContent: { xs: 'center', md: 'flex-start' },
                    mb: 5,
                    flexWrap: 'wrap',
                    gap: { xs: 1.5, sm: 2 },
                  }}
                >
                  {benefits.map((benefit, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        bgcolor: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(10px)',
                        px: 2,
                        py: 1,
                        borderRadius: 2,
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.25)',
                          transform: 'translateY(-2px)',
                        },
                      }}
                    >
                      <CheckCircleOutline
                        fontSize="small"
                        sx={{ color: 'white', fontWeight: 'bold' }}
                      />
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.95rem',
                          textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        }}
                      >
                        {benefit}
                      </Typography>
                    </Box>
                  ))}
                </Stack>

                {/* CTA Button */}
                <Button
                  variant="contained"
                  size="large"
                  component={RouterLink}
                  to="/items"
                  endIcon={<ArrowForward />}
                  sx={{
                    bgcolor: 'white',
                    color: 'primary.main',
                    px: { xs: 4, sm: 6 },
                    py: { xs: 1.5, sm: 2 },
                    fontSize: { xs: '1rem', sm: '1.1rem' },
                    fontWeight: 700,
                    borderRadius: 3,
                    textTransform: 'none',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      bgcolor: 'grey.50',
                      transform: 'translateY(-3px)',
                      boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
                    },
                  }}
                >
                  Browse Available Items
                </Button>
              </Box>
            </Grid>

            {/* Right Column - Vector Illustration */}
            <Grid
              size={{ xs: 12, md: 5 }}
              sx={{
                display: { xs: 'none', md: 'block' },
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  height: 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Vector Illustration - Delivery Truck */}
                <svg
                  viewBox="0 0 400 300"
                  style={{
                    width: '100%',
                    height: '100%',
                    filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.2))',
                  }}
                >
                  {/* Background Circle */}
                  <circle
                    cx="200"
                    cy="150"
                    r="120"
                    fill="rgba(255, 255, 255, 0.1)"
                  />

                  {/* Delivery Truck Body */}
                  <rect
                    x="80"
                    y="120"
                    width="140"
                    height="80"
                    rx="8"
                    fill="white"
                  />

                  {/* Truck Cabin */}
                  <rect
                    x="200"
                    y="140"
                    width="60"
                    height="60"
                    rx="8"
                    fill="white"
                  />

                  {/* Truck Window */}
                  <rect
                    x="210"
                    y="150"
                    width="40"
                    height="30"
                    rx="4"
                    fill="rgba(30, 64, 175, 0.2)"
                  />

                  {/* Package Icon on Truck */}
                  <rect
                    x="120"
                    y="140"
                    width="40"
                    height="40"
                    rx="4"
                    fill="rgba(30, 64, 175, 0.3)"
                  />
                  <path
                    d="M 130 155 L 140 150 L 150 155 L 140 160 Z"
                    fill="rgba(30, 64, 175, 0.5)"
                  />
                  <line
                    x1="140"
                    y1="160"
                    x2="140"
                    y2="175"
                    stroke="rgba(30, 64, 175, 0.5)"
                    strokeWidth="2"
                  />

                  {/* Wheels */}
                  <circle cx="110" cy="200" r="18" fill="white" />
                  <circle
                    cx="110"
                    cy="200"
                    r="12"
                    fill="rgba(30, 64, 175, 0.8)"
                  />
                  <circle cx="230" cy="200" r="18" fill="white" />
                  <circle
                    cx="230"
                    cy="200"
                    r="12"
                    fill="rgba(30, 64, 175, 0.8)"
                  />

                  {/* Speed Lines */}
                  <line
                    x1="50"
                    y1="130"
                    x2="70"
                    y2="130"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                  <line
                    x1="40"
                    y1="150"
                    x2="65"
                    y2="150"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                  <line
                    x1="50"
                    y1="170"
                    x2="70"
                    y2="170"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity="0.6"
                  />

                  {/* Floating Packages */}
                  <g opacity="0.8">
                    <rect
                      x="280"
                      y="80"
                      width="35"
                      height="35"
                      rx="4"
                      fill="white"
                    />
                    <path
                      d="M 287 92 L 297.5 87 L 308 92 L 297.5 97 Z"
                      fill="rgba(30, 64, 175, 0.3)"
                    />
                  </g>

                  <g opacity="0.6">
                    <rect
                      x="320"
                      y="140"
                      width="30"
                      height="30"
                      rx="4"
                      fill="white"
                    />
                    <path
                      d="M 327 150 L 335 146 L 343 150 L 335 154 Z"
                      fill="rgba(30, 64, 175, 0.3)"
                    />
                  </g>

                  {/* Location Pin */}
                  <g transform="translate(300, 200)">
                    <path
                      d="M 0 -20 Q -8 -20 -8 -12 Q -8 -4 0 8 Q 8 -4 8 -12 Q 8 -20 0 -20 Z"
                      fill="white"
                    />
                    <circle
                      cx="0"
                      cy="-12"
                      r="4"
                      fill="rgba(30, 64, 175, 0.8)"
                    />
                  </g>
                </svg>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section - Card-Based */}
      <Container
        maxWidth="lg"
        sx={{
          py: { xs: 8, md: 12 },
        }}
      >
        <Box
          sx={{
            textAlign: 'center',
            mb: { xs: 6, md: 8 },
          }}
        >
          <Typography
            variant="h3"
            component="h2"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '2rem', md: '2.75rem' },
              mb: 2,
              color: 'text.primary',
            }}
          >
            Why Choose Rendasua?
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              fontSize: { xs: '1rem', md: '1.1rem' },
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            Experience the difference with our professional delivery platform
          </Typography>
        </Box>

        <Grid container spacing={{ xs: 3, md: 4 }}>
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <Grid size={{ xs: 12, md: 4 }} key={index}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: theme.shadows[8],
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  <CardContent
                    sx={{
                      p: { xs: 3, md: 4 },
                      textAlign: 'center',
                    }}
                  >
                    {/* Icon */}
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 3,
                        transition: 'all 0.3s ease',
                        '.MuiCard-root:hover &': {
                          bgcolor: 'primary.main',
                          transform: 'scale(1.1)',
                          '& .MuiSvgIcon-root': {
                            color: 'white',
                          },
                        },
                      }}
                    >
                      <IconComponent
                        sx={{
                          fontSize: 40,
                          color: 'primary.main',
                          transition: 'color 0.3s ease',
                        }}
                      />
                    </Box>

                    {/* Title */}
                    <Typography
                      variant="h5"
                      component="h3"
                      sx={{
                        fontWeight: 700,
                        mb: 2,
                        color: 'text.primary',
                      }}
                    >
                      {feature.title}
                    </Typography>

                    {/* Description */}
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        lineHeight: 1.7,
                        fontSize: '1rem',
                      }}
                    >
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Container>

      {/* Final CTA Section - Only for Non-Authenticated Users */}
      {!isAuthenticated && (
        <Box
          sx={{
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            py: { xs: 6, md: 10 },
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Container maxWidth="md">
            <Box
              sx={{
                textAlign: 'center',
                maxWidth: 600,
                mx: 'auto',
              }}
            >
              <Typography
                variant="h4"
                component="h2"
                sx={{
                  fontWeight: 700,
                  mb: 2,
                  fontSize: { xs: '1.75rem', md: '2.25rem' },
                  color: 'text.primary',
                }}
              >
                Ready to Get Started?
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  mb: 4,
                  color: 'text.secondary',
                  fontSize: { xs: '1rem', md: '1.1rem' },
                  lineHeight: 1.6,
                }}
              >
                Join thousands of satisfied customers and experience fast,
                reliable delivery today
              </Typography>
              <Button
                variant="contained"
                size="large"
                component={RouterLink}
                to="/items"
                endIcon={<ArrowForward />}
                sx={{
                  px: 5,
                  py: 2,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  borderRadius: 3,
                  textTransform: 'none',
                  boxShadow: theme.shadows[4],
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.shadows[8],
                  },
                }}
              >
                Start Browsing Items
              </Button>
            </Box>
          </Container>
        </Box>
      )}
    </Box>
  );
};

export default LandingPage;
