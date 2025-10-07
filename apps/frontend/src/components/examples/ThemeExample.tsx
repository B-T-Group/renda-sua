import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Typography,
  TextField,
  Chip,
  Stack,
} from '@mui/material';
import { LocalShipping, Store, Payment, CheckCircle } from '@mui/icons-material';
import { useTheme } from '../../hooks/useTheme';

/**
 * Example component demonstrating how to use the enhanced theme system
 * This shows how to avoid hardcoded styles and use theme-based styling
 */
const ThemeExample: React.FC = () => {
  const theme = useTheme();

  const benefits = [
    {
      icon: LocalShipping,
      title: 'Fast Delivery',
      description: 'Get your items delivered within 24-48 hours',
      color: theme.colors.primary.main,
    },
    {
      icon: Store,
      title: 'Wide Selection',
      description: 'Browse thousands of products from local businesses',
      color: theme.colors.secondary.main,
    },
    {
      icon: Payment,
      title: 'Best Prices',
      description: 'Competitive prices with no hidden fees',
      color: theme.colors.success.main,
    },
    {
      icon: CheckCircle,
      title: 'Shop from Home',
      description: 'Order everything from the comfort of your home',
      color: theme.colors.info.main,
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: theme.colors.background.default }}>
      {/* Hero Section using theme styles */}
      <Box sx={theme.styles.hero}>
        <Container maxWidth="lg" sx={theme.styles.container}>
          <Grid container spacing={4} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography
                variant="h1"
                sx={{
                  ...theme.utils.typography.responsive.h1,
                  color: theme.colors.primary.contrast,
                  mb: theme.spacing.md,
                }}
              >
                Fast Delivery in Gabon
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  ...theme.utils.typography.responsive.body,
                  color: theme.colors.primary.contrast,
                  mb: theme.spacing.lg,
                  opacity: 0.9,
                }}
              >
                Shop from a wide selection of products and get them delivered
                to your doorstep within 24-48 hours
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="contained"
                  size="large"
                  sx={{
                    ...theme.styles.button,
                    bgcolor: theme.colors.background.paper,
                    color: theme.colors.primary.main,
                    px: theme.spacing.lg,
                    py: theme.spacing.sm,
                    boxShadow: theme.elevation.lg,
                    '&:hover': {
                      bgcolor: theme.colors.background.paper,
                      transform: 'translateY(-2px)',
                      boxShadow: theme.elevation.xl,
                    },
                  }}
                >
                  Shop Now
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  sx={{
                    ...theme.styles.button,
                    borderColor: theme.colors.primary.contrast,
                    color: theme.colors.primary.contrast,
                    px: theme.spacing.lg,
                    py: theme.spacing.sm,
                    borderWidth: 2,
                    '&:hover': {
                      borderWidth: 2,
                      bgcolor: theme.colors.primary.contrast,
                      color: theme.colors.primary.main,
                    },
                  }}
                >
                  Sign Up
                </Button>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography
                  variant="h6"
                  sx={{
                    color: theme.colors.primary.contrast,
                    mb: theme.spacing.md,
                  }}
                >
                  Trust Signals
                </Typography>
                <Stack direction="row" spacing={3} justifyContent="center">
                  <Box sx={theme.styles.trustSignal}>
                    <LocalShipping />
                    <Typography variant="body2">24-48h delivery</Typography>
                  </Box>
                  <Box sx={theme.styles.trustSignal}>
                    <Payment />
                    <Typography variant="body2">Secure payments</Typography>
                  </Box>
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Benefits Section using theme styles */}
      <Box sx={theme.styles.section}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            sx={{
              ...theme.utils.typography.responsive.h3,
              textAlign: 'center',
              mb: theme.spacing.lg,
              color: theme.colors.text.primary,
            }}
          >
            Why Choose Rendasua?
          </Typography>
          <Grid container spacing={4}>
            {benefits.map((benefit, index) => {
              const IconComponent = benefit.icon;
              return (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                  <Card sx={theme.styles.benefitCard}>
                    <CardContent sx={{ p: theme.spacing.lg, textAlign: 'center' }}>
                      <Box sx={theme.styles.iconContainer(benefit.color)}>
                        <IconComponent sx={{ fontSize: 32, color: 'white' }} />
                      </Box>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          mb: theme.spacing.sm,
                          color: theme.colors.primary.main,
                        }}
                      >
                        {benefit.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: theme.colors.text.primary,
                          lineHeight: 1.6,
                        }}
                      >
                        {benefit.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      {/* Form Example using theme styles */}
      <Box sx={{ bgcolor: theme.colors.background.paper, ...theme.styles.section }}>
        <Container maxWidth="md">
          <Typography
            variant="h4"
            sx={{
              ...theme.utils.typography.responsive.h3,
              textAlign: 'center',
              mb: theme.spacing.xl,
              color: theme.colors.text.primary,
            }}
          >
            Contact Form Example
          </Typography>
          <Box
            component="form"
            sx={{
              maxWidth: 600,
              mx: 'auto',
              '& .MuiTextField-root': {
                mb: theme.spacing.md,
              },
            }}
          >
            <TextField
              fullWidth
              label="Name"
              variant="outlined"
              sx={theme.styles.input}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              variant="outlined"
              sx={theme.styles.input}
            />
            <TextField
              fullWidth
              label="Message"
              multiline
              rows={4}
              variant="outlined"
              sx={theme.styles.input}
            />
            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: theme.spacing.lg }}>
              <Button
                variant="contained"
                size="large"
                sx={{
                  ...theme.styles.button,
                  px: theme.spacing.xl,
                  py: theme.spacing.sm,
                }}
              >
                Send Message
              </Button>
              <Button
                variant="outlined"
                size="large"
                sx={{
                  ...theme.styles.button,
                  px: theme.spacing.xl,
                  py: theme.spacing.sm,
                }}
              >
                Cancel
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Chips Example */}
      <Box sx={{ ...theme.styles.section, bgcolor: theme.colors.background.default }}>
        <Container maxWidth="md">
          <Typography
            variant="h5"
            sx={{
              textAlign: 'center',
              mb: theme.spacing.lg,
              color: theme.colors.text.primary,
            }}
          >
            Category Tags
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap">
            <Chip
              label="Electronics"
              color="primary"
              sx={{ borderRadius: theme.radius.md }}
            />
            <Chip
              label="Clothing"
              color="secondary"
              sx={{ borderRadius: theme.radius.md }}
            />
            <Chip
              label="Food"
              color="success"
              sx={{ borderRadius: theme.radius.md }}
            />
            <Chip
              label="Books"
              color="info"
              sx={{ borderRadius: theme.radius.md }}
            />
            <Chip
              label="Sports"
              color="warning"
              sx={{ borderRadius: theme.radius.md }}
            />
          </Stack>
        </Container>
      </Box>
    </Box>
  );
};

export default ThemeExample;
