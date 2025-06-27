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
  Chip,
} from '@mui/material';
import {
  LocalShipping,
  Speed,
  LocationOn,
  ArrowForward,
  CheckCircle,
  AccessTime,
} from '@mui/icons-material';
import { useAuth0 } from '@auth0/auth0-react';
import Logo from '../common/Logo';

const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth0();

  const features = [
    {
      icon: <LocalShipping color="primary" sx={{ fontSize: 40 }} />,
      title: 'Fast Delivery',
      description: 'Get your packages delivered quickly and reliably across the city',
    },
    {
      icon: <Speed color="primary" sx={{ fontSize: 40 }} />,
      title: 'Real-time Tracking',
      description: 'Track your deliveries in real-time with our advanced GPS system',
    },
    {
      icon: <LocationOn color="primary" sx={{ fontSize: 40 }} />,
      title: 'Wide Coverage',
      description: 'Serving all neighborhoods with our extensive delivery network',
    },
  ];

  const benefits = [
    'Same-day delivery available',
    'Secure package handling',
    'Flexible delivery times',
    'Professional delivery agents',
    'Insurance coverage included',
    '24/7 customer support',
  ];

  return (
    <Box>
      {/* Hero Section */}
      <Paper
        sx={{
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          color: 'white',
          py: 8,
          mb: 6,
        }}
      >
        <Container maxWidth="lg">
          <Box textAlign="center">
            <Logo variant="with-tagline" color="white" size="large" />
            <Typography
              variant="h2"
              component="h1"
              gutterBottom
              sx={{ mt: 4, fontWeight: 700 }}
            >
              Fast & Reliable Delivery Service
            </Typography>
            <Typography
              variant="h5"
              component="h2"
              sx={{ mb: 4, opacity: 0.9, maxWidth: 600, mx: 'auto' }}
            >
              Connect with trusted delivery agents and get your packages delivered safely and on time
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
                Start Delivering
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
          Why Choose Renda Sua?
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

      {/* Benefits Section */}
      <Paper
        sx={{
          bgcolor: 'grey.50',
          py: 6,
          mb: 6,
        }}
      >
        <Container maxWidth="lg">
          <Typography
            variant="h4"
            component="h2"
            textAlign="center"
            gutterBottom
            sx={{ mb: 4 }}
          >
            What You Get
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, 1fr)',
              },
              gap: 3,
            }}
          >
            {benefits.map((benefit, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <CheckCircle color="success" />
                <Typography variant="body1">{benefit}</Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Paper>

      {/* CTA Section */}
      {!isAuthenticated && (
        <Paper
          sx={{
            bgcolor: 'secondary.main',
            color: 'white',
            py: 6,
            textAlign: 'center',
          }}
        >
          <Container maxWidth="md">
            <Typography variant="h4" component="h2" gutterBottom>
              Ready to Get Started?
            </Typography>
            <Typography variant="body1" sx={{ mb: 4, opacity: 0.9 }}>
              Join our network of trusted delivery agents and customers
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                sx={{ 
                  px: 4, 
                  py: 1.5, 
                  fontSize: '1.1rem',
                  bgcolor: 'white',
                  color: 'secondary.main',
                  '&:hover': {
                    bgcolor: 'grey.100',
                  },
                }}
                endIcon={<ArrowForward />}
              >
                Become a Client
              </Button>
              <Button
                variant="outlined"
                size="large"
                sx={{ 
                  px: 4, 
                  py: 1.5, 
                  fontSize: '1.1rem',
                  borderColor: 'white',
                  color: 'white',
                  '&:hover': {
                    borderColor: 'white',
                    bgcolor: 'rgba(255,255,255,0.1)',
                  },
                }}
                endIcon={<LocalShipping />}
              >
                Become an Agent
              </Button>
            </Box>
          </Container>
        </Paper>
      )}
    </Box>
  );
};

export default LandingPage; 