import { useAuth0 } from '@auth0/auth0-react';
import {
  AccessTime,
  ArrowForward,
  CheckCircle,
  LocalShipping,
  LocationOn,
  Security,
  Speed,
  Star,
  Support,
  TrendingUp,
  VerifiedUser,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import React, { useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useSEO } from '../../hooks/useSEO';
import Logo from '../common/Logo';
import { SEOHead } from '../seo';

const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  const { userType, loading, isProfileComplete } = useUserProfileContext();

  // Redirect authenticated users to their appropriate home page
  useEffect(() => {
    if (isAuthenticated && !loading && isProfileComplete && userType) {
      switch (userType) {
        case 'client':
          navigate('/items');
          break;
        case 'agent':
          navigate('/agent-dashboard');
          break;
        case 'business':
          navigate('/business-dashboard');
          break;
        default:
          // Stay on landing page for unknown user types
          break;
      }
    }
  }, [isAuthenticated, loading, isProfileComplete, userType, navigate]);

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
      icon: <LocalShipping sx={{ fontSize: 48, color: 'primary.main' }} />,
      title: 'Lightning Fast Delivery',
      description:
        'Get your packages delivered in record time with our optimized delivery network',
      color: 'primary.main',
    },
    {
      icon: <Speed sx={{ fontSize: 48, color: 'secondary.main' }} />,
      title: 'Real-time Tracking',
      description:
        'Track your deliveries live with our advanced GPS and notification system',
      color: 'secondary.main',
    },
    {
      icon: <LocationOn sx={{ fontSize: 48, color: 'info.main' }} />,
      title: 'City-wide Coverage',
      description:
        'Serving every neighborhood with our extensive delivery network',
      color: 'info.main',
    },
  ];

  const benefits = [
    { text: 'Same-day delivery available', icon: <AccessTime /> },
    { text: 'Secure package handling', icon: <Security /> },
    { text: 'Flexible delivery times', icon: <TrendingUp /> },
    { text: 'Professional delivery agents', icon: <VerifiedUser /> },
    { text: 'Insurance coverage included', icon: <CheckCircle /> },
    { text: '24/7 customer support', icon: <Support /> },
  ];

  const stats = [
    { number: '10K+', label: 'Happy Customers' },
    { number: '500+', label: 'Delivery Agents' },
    { number: '99%', label: 'On-time Delivery' },
    { number: '24/7', label: 'Support Available' },
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
                mb: 4,
                color: 'rgba(255, 255, 255, 0.9)',
                maxWidth: 700,
                mx: 'auto',
                fontWeight: 400,
                lineHeight: 1.4,
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
              }}
            >
              Connect with trusted delivery agents and get your packages
              delivered safely and on time, every time
            </Typography>

            {/* Browse Items Button */}
            <Box sx={{ mb: 6 }}>
              <Button
                variant="contained"
                size="large"
                component={RouterLink}
                to="/items"
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.95)',
                  color: '#1e40af',
                  px: 8,
                  py: 2.5,
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  borderRadius: 4,
                  textTransform: 'none',
                  boxShadow: '0 8px 32px rgba(255, 255, 255, 0.4)',
                  border: '2px solid rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    bgcolor: 'white',
                    transform: 'translateY(-3px)',
                    boxShadow: '0 16px 48px rgba(255, 255, 255, 0.6)',
                    border: '2px solid white',
                  },
                  '&:active': {
                    transform: 'translateY(-1px)',
                  },
                }}
                endIcon={
                  <ArrowForward
                    sx={{
                      fontSize: '1.2rem',
                      transition: 'transform 0.3s ease',
                      '.MuiButton-root:hover &': {
                        transform: 'translateX(4px)',
                      },
                    }}
                  />
                }
              >
                Browse Items
              </Button>
            </Box>
            {!isAuthenticated && (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                justifyContent="center"
                alignItems="center"
              >
                <Button
                  variant="contained"
                  size="large"
                  sx={{
                    bgcolor: 'white',
                    color: 'primary.main',
                    px: 6,
                    py: 2,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(255,255,255,0.3)',
                    '&:hover': {
                      bgcolor: 'grey.100',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 12px 40px rgba(255,255,255,0.4)',
                    },
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  endIcon={<ArrowForward />}
                >
                  Start Delivering
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  sx={{
                    borderColor: 'white',
                    color: 'white',
                    px: 6,
                    py: 2,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    borderRadius: 3,
                    borderWidth: 2,
                    '&:hover': {
                      borderColor: 'white',
                      bgcolor: 'rgba(255,255,255,0.1)',
                      transform: 'translateY(-2px)',
                    },
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  Learn More
                </Button>
              </Stack>
            )}
          </Box>
        </Container>
      </Paper>

      {/* Stats Section */}
      <Container maxWidth="lg" sx={{ mb: 8 }}>
        <Grid container spacing={4} justifyContent="center">
          {stats.map((stat, index) => (
            <Grid item xs={6} md={3} key={index}>
              <Box textAlign="center">
                <Typography
                  variant="h2"
                  component="div"
                  sx={{
                    fontWeight: 800,
                    color: 'primary.main',
                    fontSize: { xs: '2rem', md: '3rem' },
                  }}
                >
                  {stat.number}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 500,
                    fontSize: '0.9rem',
                  }}
                >
                  {stat.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ mb: 10 }}>
        <Box textAlign="center" sx={{ mb: 8 }}>
          <Typography
            variant="h2"
            component="h2"
            gutterBottom
            sx={{
              fontWeight: 700,
              fontSize: { xs: '2rem', md: '3rem' },
              letterSpacing: '-0.02em',
            }}
          >
            Why Choose Renda Sua?
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: 'text.secondary',
              maxWidth: 600,
              mx: 'auto',
              fontWeight: 400,
            }}
          >
            Experience the future of delivery with our cutting-edge platform
          </Typography>
        </Box>
        <Grid container spacing={4} justifyContent="center">
          {features.map((feature, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  textAlign: 'center',
                  p: 4,
                  borderRadius: 4,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                  },
                }}
              >
                <CardContent
                  sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <Box sx={{ mb: 3 }}>
                    <Avatar
                      sx={{
                        width: 80,
                        height: 80,
                        mx: 'auto',
                        bgcolor: `${feature.color}15`,
                        color: feature.color,
                        mb: 2,
                      }}
                    >
                      {feature.icon}
                    </Avatar>
                  </Box>
                  <Typography
                    variant="h5"
                    component="h3"
                    gutterBottom
                    sx={{ fontWeight: 700, mb: 2, textAlign: 'center' }}
                  >
                    {feature.title}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: 'text.secondary',
                      lineHeight: 1.6,
                      textAlign: 'center',
                    }}
                  >
                    {feature.description}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'center', pt: 0 }}>
                  <Button
                    size="small"
                    endIcon={<ArrowForward />}
                    sx={{ fontWeight: 600 }}
                  >
                    Learn More
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Benefits Section */}
      <Paper
        sx={{
          bgcolor: 'grey.50',
          py: 8,
          mb: 8,
        }}
      >
        <Container maxWidth="lg">
          <Box textAlign="center" sx={{ mb: 6 }}>
            <Typography
              variant="h2"
              component="h2"
              gutterBottom
              sx={{
                fontWeight: 700,
                fontSize: { xs: '2rem', md: '3rem' },
                letterSpacing: '-0.02em',
              }}
            >
              What You Get
            </Typography>
            <Typography
              variant="h6"
              sx={{
                color: 'text.secondary',
                maxWidth: 600,
                mx: 'auto',
                fontWeight: 400,
              }}
            >
              Comprehensive benefits designed for your delivery needs
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {benefits.map((benefit, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    p: 3,
                    borderRadius: 2,
                    bgcolor: 'white',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateX(4px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    },
                  }}
                >
                  <Avatar
                    sx={{
                      bgcolor: 'primary.main',
                      color: 'white',
                      width: 48,
                      height: 48,
                    }}
                  >
                    {benefit.icon}
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {benefit.text}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Paper>

      {/* Testimonials Section */}
      <Container maxWidth="lg" sx={{ mb: 8 }}>
        <Box textAlign="center" sx={{ mb: 6 }}>
          <Typography
            variant="h2"
            component="h2"
            gutterBottom
            sx={{
              fontWeight: 700,
              fontSize: { xs: '2rem', md: '3rem' },
              letterSpacing: '-0.02em',
            }}
          >
            What Our Customers Say
          </Typography>
        </Box>
        <Grid container spacing={4}>
          {[1, 2, 3].map((item) => (
            <Grid item xs={12} md={4} key={item}>
              <Card sx={{ p: 4, borderRadius: 4, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      sx={{ color: 'warning.main', fontSize: 20 }}
                    />
                  ))}
                </Box>
                <Typography variant="body1" sx={{ mb: 3, fontStyle: 'italic' }}>
                  "Renda Sua has transformed how I handle deliveries. Fast,
                  reliable, and the tracking is incredible!"
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>JD</Avatar>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      John Doe
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Business Owner
                    </Typography>
                  </Box>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA Section */}
      {!isAuthenticated && (
        <Paper
          sx={{
            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
            color: 'white',
            py: 8,
            textAlign: 'center',
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
          <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
            <Typography
              variant="h2"
              component="h2"
              gutterBottom
              sx={{
                fontWeight: 700,
                fontSize: { xs: '2rem', md: '3rem' },
                letterSpacing: '-0.02em',
              }}
            >
              Ready to Get Started?
            </Typography>
            <Typography
              variant="h6"
              sx={{
                mb: 6,
                opacity: 0.95,
                fontWeight: 400,
                color: 'white',
              }}
            >
              Join our network of trusted delivery agents and customers today
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={3}
              justifyContent="center"
              alignItems="center"
            >
              <Button
                variant="contained"
                size="large"
                sx={{
                  px: 6,
                  py: 2,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  bgcolor: 'white',
                  color: 'secondary.main',
                  borderRadius: 3,
                  boxShadow: '0 8px 32px rgba(255,255,255,0.3)',
                  '&:hover': {
                    bgcolor: 'grey.100',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 40px rgba(255,255,255,0.4)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                endIcon={<ArrowForward />}
              >
                Become a Client
              </Button>
              <Button
                variant="outlined"
                size="large"
                sx={{
                  px: 6,
                  py: 2,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  borderColor: 'white',
                  color: 'white',
                  borderRadius: 3,
                  borderWidth: 2,
                  '&:hover': {
                    borderColor: 'white',
                    bgcolor: 'rgba(255,255,255,0.1)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                endIcon={<LocalShipping />}
              >
                Become an Agent
              </Button>
            </Stack>
          </Container>
        </Paper>
      )}
    </Box>
  );
};

export default LandingPage;
