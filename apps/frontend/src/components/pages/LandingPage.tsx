import { useAuth0 } from '@auth0/auth0-react';
import {
  ArrowForward,
  BusinessCenter,
  CheckCircle,
  LocalShipping,
  Payment,
  Schedule,
  ShoppingCart,
  Store,
  Verified,
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
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useSEO } from '../../hooks/useSEO';
import Logo from '../common/Logo';
import { SEOHead } from '../seo';

const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth0();
  const theme = useTheme();
  const { t } = useTranslation();

  // SEO configuration for landing page
  const seoConfig = useSEO({
    title: t('landing.seo.title', 'Rendasua - Fast Delivery in Gabon | 24-48h'),
    description: t(
      'landing.seo.description',
      'Order and receive your items in 24-48h anywhere in Gabon. Wide selection, best prices, secure Airtel Money payment. Home delivery.'
    ),
    keywords: t(
      'landing.seo.keywords',
      'delivery Gabon, Airtel Money, online shopping Gabon, fast delivery, Rendasua, e-commerce Gabon, online shopping'
    ),
    type: 'website',
  });

  const howItWorksSteps = [
    {
      icon: ShoppingCart,
      title: t('landing.howItWorks.steps.placeOrder.title', 'Place Your Order'),
      description: t(
        'landing.howItWorks.steps.placeOrder.description',
        'Browse our wide selection and add items to your cart'
      ),
      color: theme.palette.primary.main,
    },
    {
      icon: Verified,
      title: t(
        'landing.howItWorks.steps.orderConfirmed.title',
        'Order Confirmed & Prepared'
      ),
      description: t(
        'landing.howItWorks.steps.orderConfirmed.description',
        'Your order is confirmed and prepared by the business'
      ),
      color: theme.palette.success.main,
    },
    {
      icon: LocalShipping,
      title: t('landing.howItWorks.steps.pickup.title', 'Order Picked Up'),
      description: t(
        'landing.howItWorks.steps.pickup.description',
        'A delivery agent picks up your order from the business'
      ),
      color: theme.palette.warning.main,
    },
    {
      icon: CheckCircle,
      title: t('landing.howItWorks.steps.delivered.title', 'Delivered to You'),
      description: t(
        'landing.howItWorks.steps.delivered.description',
        'Your order is delivered safely to your doorstep'
      ),
      color: theme.palette.info.main,
    },
  ];

  const keyBenefits = [
    {
      icon: LocalShipping,
      title: t('landing.benefits.fastDelivery.title', 'Fast Delivery'),
      description: t(
        'landing.benefits.fastDelivery.description',
        'Get your items delivered within 24-48 hours across Gabon'
      ),
    },
    {
      icon: Store,
      title: t('landing.benefits.wideSelection.title', 'Wide Selection'),
      description: t(
        'landing.benefits.wideSelection.description',
        'Browse thousands of products from local businesses'
      ),
    },
    {
      icon: Payment,
      title: t('landing.benefits.bestPrices.title', 'Best Prices'),
      description: t(
        'landing.benefits.bestPrices.description',
        'Competitive prices with no hidden fees or charges'
      ),
    },
    {
      icon: CheckCircle,
      title: t('landing.benefits.shopFromHome.title', 'Shop from Home'),
      description: t(
        'landing.benefits.shopFromHome.description',
        'Order everything you need from the comfort of your home'
      ),
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <SEOHead {...seoConfig} />

      {/* Hero Section */}
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
            py: { xs: 8, md: 12 },
            zIndex: 1,
          }}
        >
          <Grid container spacing={4} alignItems="center">
            {/* Left Column - Text Content */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                {/* Logo */}
                <Box sx={{ mb: 3 }}>
                  <Logo variant="with-tagline" color="white" size="large" />
                </Box>

                {/* Value Proposition */}
                <Typography
                  variant="h1"
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: '2.25rem', sm: '3rem', md: '3.5rem' },
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                    mb: 2,
                    background:
                      'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.85) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {t(
                    'landing.hero.title',
                    'Fast Delivery of Quality Items in Gabon'
                  )}
                </Typography>

                {/* Subtitle */}
                <Typography
                  variant="h6"
                  sx={{
                    mb: 4,
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontWeight: 400,
                    lineHeight: 1.6,
                    fontSize: { xs: '1rem', md: '1.2rem' },
                  }}
                >
                  {t(
                    'landing.hero.subtitle',
                    'Shop from a wide selection of products and get them delivered to your doorstep within 24-48 hours'
                  )}
                </Typography>

                {/* CTA Buttons */}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{
                    justifyContent: { xs: 'center', md: 'flex-start' },
                    mb: 4,
                  }}
                >
                  <Button
                    variant="contained"
                    size="large"
                    component={RouterLink}
                    to="/items"
                    endIcon={<ArrowForward />}
                    sx={{
                      bgcolor: 'primary.main',
                      color: 'white',
                      px: 4,
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      borderRadius: 3,
                      textTransform: 'none',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
                      },
                    }}
                  >
                    {t('landing.hero.shopNow', 'Shop Now')}
                  </Button>
                  {!isAuthenticated && (
                    <Button
                      variant="outlined"
                      size="large"
                      component={RouterLink}
                      to="/app"
                      sx={{
                        borderColor: 'primary.main',
                        color: 'text.primary',
                        px: 4,
                        py: 1.5,
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        borderRadius: 3,
                        textTransform: 'none',
                        borderWidth: 2,
                        '&:hover': {
                          borderWidth: 2,
                          bgcolor: 'rgba(255,255,255,0.1)',
                          borderColor: 'primary.main',
                        },
                      }}
                    >
                      {t('landing.hero.signUp', 'Sign Up')}
                    </Button>
                  )}
                </Stack>

                {/* Trust Signals */}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={3}
                  sx={{
                    justifyContent: { xs: 'center', md: 'flex-start' },
                    alignItems: 'center',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Schedule sx={{ fontSize: 24 }} />
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, fontSize: '0.95rem', color: 'white' }}
                    >
                      {t(
                        'landing.hero.trustSignals.deliveryTime',
                        '24-48h delivery'
                      )}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Payment sx={{ fontSize: 24 }} />
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, fontSize: '0.95rem', color: 'white' }}
                    >
                      {t(
                        'landing.hero.trustSignals.securePayment',
                        'Secure payments (Airtel Money)'
                      )}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Grid>

            {/* Right Column - Hero Illustration */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  viewBox="0 0 500 400"
                  style={{
                    width: '100%',
                    maxWidth: 500,
                    height: 'auto',
                    filter: 'drop-shadow(0 20px 60px rgba(0,0,0,0.15))',
                  }}
                >
                  {/* Background Elements */}
                  <circle
                    cx="250"
                    cy="200"
                    r="180"
                    fill="rgba(255,255,255,0.08)"
                  />
                  <circle
                    cx="250"
                    cy="200"
                    r="140"
                    fill="rgba(255,255,255,0.06)"
                  />

                  {/* Shopping Cart */}
                  <g transform="translate(150, 180)">
                    <rect
                      x="0"
                      y="20"
                      width="80"
                      height="60"
                      rx="8"
                      fill="white"
                    />
                    <circle cx="20" cy="95" r="10" fill="white" />
                    <circle cx="60" cy="95" r="10" fill="white" />
                    <path
                      d="M 10 20 L 20 0 L 80 0 L 75 20 Z"
                      fill="white"
                      opacity="0.9"
                    />
                    {/* Items in cart */}
                    <rect
                      x="15"
                      y="30"
                      width="25"
                      height="25"
                      rx="4"
                      fill={theme.palette.primary.main}
                      opacity="0.3"
                    />
                    <rect
                      x="45"
                      y="30"
                      width="25"
                      height="25"
                      rx="4"
                      fill={theme.palette.secondary.main}
                      opacity="0.3"
                    />
                  </g>

                  {/* Delivery Truck */}
                  <g transform="translate(280, 160)">
                    <rect
                      x="0"
                      y="30"
                      width="100"
                      height="60"
                      rx="8"
                      fill="white"
                    />
                    <rect
                      x="80"
                      y="40"
                      width="50"
                      height="50"
                      rx="8"
                      fill="white"
                    />
                    <rect
                      x="88"
                      y="48"
                      width="34"
                      height="25"
                      rx="4"
                      fill={alpha(theme.palette.primary.main, 0.2)}
                    />
                    {/* Wheels */}
                    <circle cx="30" cy="90" r="14" fill="white" />
                    <circle
                      cx="30"
                      cy="90"
                      r="9"
                      fill={theme.palette.primary.main}
                    />
                    <circle cx="105" cy="90" r="14" fill="white" />
                    <circle
                      cx="105"
                      cy="90"
                      r="9"
                      fill={theme.palette.primary.main}
                    />
                    {/* Package */}
                    <rect
                      x="25"
                      y="45"
                      width="30"
                      height="30"
                      rx="4"
                      fill={theme.palette.success.main}
                      opacity="0.3"
                    />
                  </g>

                  {/* House/Destination */}
                  <g transform="translate(350, 280)">
                    <rect x="0" y="20" width="60" height="50" fill="white" />
                    <path d="M -10 20 L 30 -10 L 70 20 Z" fill="white" />
                    <rect
                      x="15"
                      y="35"
                      width="30"
                      height="35"
                      rx="2"
                      fill={alpha(theme.palette.primary.main, 0.2)}
                    />
                    <rect
                      x="20"
                      y="40"
                      width="10"
                      height="10"
                      fill={theme.palette.warning.main}
                      opacity="0.5"
                    />
                    <rect
                      x="35"
                      y="40"
                      width="10"
                      height="10"
                      fill={theme.palette.warning.main}
                      opacity="0.5"
                    />
                  </g>

                  {/* Connecting Path with Checkmarks */}
                  <path
                    d="M 200 220 Q 250 200 310 200"
                    stroke="white"
                    strokeWidth="3"
                    strokeDasharray="5,5"
                    fill="none"
                    opacity="0.5"
                  />
                  <circle cx="210" cy="218" r="8" fill="white" />
                  <path
                    d="M 207 218 L 209 220 L 213 216"
                    stroke={theme.palette.success.main}
                    strokeWidth="2"
                    fill="none"
                  />

                  {/* Floating Icons */}
                  <g opacity="0.7">
                    <circle cx="100" cy="100" r="25" fill="white" />
                    <path
                      d="M 100 85 L 110 95 L 100 105 L 90 95 Z"
                      fill={theme.palette.info.main}
                      opacity="0.4"
                    />
                  </g>
                  <g opacity="0.6">
                    <circle cx="420" cy="120" r="20" fill="white" />
                    <rect
                      x="410"
                      y="110"
                      width="20"
                      height="20"
                      rx="3"
                      fill={theme.palette.success.main}
                      opacity="0.4"
                    />
                  </g>
                </svg>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* How It Works Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography
            variant="h3"
            component="h2"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.75rem', md: '2.5rem' },
              mb: 2,
              color: 'text.primary',
            }}
          >
            {t('landing.howItWorks.title', 'How It Works')}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              fontSize: '1.1rem',
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            {t(
              'landing.howItWorks.subtitle',
              'Get your items delivered in 4 simple steps'
            )}
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {howItWorksSteps.map((step, index) => {
            const IconComponent = step.icon;
            return (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    border: '2px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    position: 'relative',
                    overflow: 'visible',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      borderColor: step.color,
                      boxShadow: theme.shadows[8],
                    },
                  }}
                >
                  <CardContent
                    sx={{
                      p: 3,
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    {/* Step Number */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -15,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        bgcolor: step.color,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                      }}
                    >
                      {index + 1}
                    </Box>

                    {/* Icon */}
                    <Box
                      sx={{
                        width: 70,
                        height: 70,
                        borderRadius: '50%',
                        bgcolor: alpha(step.color, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mt: 2,
                        mb: 2,
                      }}
                    >
                      <IconComponent sx={{ fontSize: 35, color: step.color }} />
                    </Box>

                    {/* Title */}
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        mb: 1,
                        color: 'text.primary',
                      }}
                    >
                      {step.title}
                    </Typography>

                    {/* Description */}
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        lineHeight: 1.6,
                      }}
                    >
                      {step.description}
                    </Typography>
                  </CardContent>

                  {/* Connector Arrow */}
                  {index < howItWorksSteps.length - 1 && (
                    <Box
                      sx={{
                        display: { xs: 'none', md: 'block' },
                        position: 'absolute',
                        right: -20,
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                    >
                      <ArrowForward sx={{ color: 'divider', fontSize: 30 }} />
                    </Box>
                  )}
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Container>

      {/* Key Benefits Section */}
      <Box
        sx={{
          bgcolor: alpha(theme.palette.primary.main, 0.02),
          py: { xs: 8, md: 12 },
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography
              variant="h3"
              component="h2"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1.75rem', md: '2.5rem' },
                mb: 2,
                color: 'text.primary',
              }}
            >
              {t('landing.benefits.title', 'Why Choose Rendasua?')}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
                fontSize: '1.1rem',
                maxWidth: 700,
                mx: 'auto',
              }}
            >
              {t(
                'landing.benefits.subtitle',
                'Experience the best in online shopping and delivery'
              )}
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {keyBenefits.map((benefit, index) => {
              const IconComponent = benefit.icon;
              return (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                  <Card
                    elevation={0}
                    sx={{
                      height: '100%',
                      bgcolor: 'primary.main',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 3,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        boxShadow: theme.shadows[12],
                        borderColor: 'primary.main',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 3, textAlign: 'center' }}>
                      <Box
                        sx={{
                          width: 60,
                          height: 60,
                          borderRadius: '50%',
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mx: 'auto',
                          mb: 2,
                        }}
                      >
                        <IconComponent
                          sx={{
                            fontSize: 32,
                            color: 'white',
                          }}
                        />
                      </Box>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          mb: 1,
                          color: 'text.primary',
                        }}
                      >
                        {benefit.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
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

      {/* Business Account CTA Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Card
          elevation={0}
          sx={{
            bgcolor: alpha(theme.palette.primary.main, 0.05),
            border: '2px solid',
            borderColor: 'primary.main',
            borderRadius: 4,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <CardContent sx={{ p: { xs: 4, md: 6 } }}>
            <Grid container spacing={4} alignItems="center">
              <Grid size={{ xs: 12, md: 7 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <BusinessCenter
                    sx={{
                      fontSize: 40,
                      color: 'white',
                      mr: 2,
                    }}
                  />
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 800,
                      fontSize: { xs: '1.5rem', md: '2rem' },
                      color: 'text.primary',
                    }}
                  >
                    {t('landing.businessCta.title', 'Sell on Rendasua Today')}
                  </Typography>
                </Box>
                <Typography
                  variant="body1"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '1.1rem',
                    lineHeight: 1.7,
                    mb: 3,
                  }}
                >
                  {t(
                    'landing.businessCta.description',
                    'Open a business account and start selling your products to customers across Gabon. Manage your inventory, track orders, and grow your business with our comprehensive platform.'
                  )}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button
                    variant="contained"
                    size="large"
                    component={RouterLink}
                    to="/app"
                    endIcon={<ArrowForward />}
                    sx={{
                      px: 4,
                      py: 1.5,
                      fontSize: '1.05rem',
                      fontWeight: 600,
                      borderRadius: 2,
                      textTransform: 'none',
                    }}
                  >
                    {t(
                      'landing.businessCta.openBusinessAccount',
                      'Open Business Account'
                    )}
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    component={RouterLink}
                    to="/about"
                    sx={{
                      px: 4,
                      py: 1.5,
                      fontSize: '1.05rem',
                      fontWeight: 600,
                      borderRadius: 2,
                      textTransform: 'none',
                    }}
                  >
                    Learn More
                  </Button>
                </Stack>
              </Grid>

              {/* Business Illustration */}
              <Grid size={{ xs: 12, md: 5 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <svg
                    viewBox="0 0 300 300"
                    style={{
                      width: '100%',
                      maxWidth: 280,
                      height: 'auto',
                    }}
                  >
                    {/* Store Building */}
                    <rect
                      x="50"
                      y="100"
                      width="200"
                      height="150"
                      rx="8"
                      fill="white"
                    />
                    <rect
                      x="50"
                      y="80"
                      width="200"
                      height="20"
                      fill={theme.palette.primary.main}
                    />
                    {/* Awning */}
                    <path
                      d="M 40 100 L 50 80 L 250 80 L 260 100 Z"
                      fill={theme.palette.primary.main}
                      opacity="0.3"
                    />
                    {/* Door */}
                    <rect
                      x="120"
                      y="180"
                      width="60"
                      height="70"
                      rx="4"
                      fill={alpha(theme.palette.primary.main, 0.2)}
                    />
                    {/* Windows */}
                    <rect
                      x="70"
                      y="120"
                      width="40"
                      height="40"
                      rx="4"
                      fill={alpha(theme.palette.info.main, 0.2)}
                    />
                    <rect
                      x="190"
                      y="120"
                      width="40"
                      height="40"
                      rx="4"
                      fill={alpha(theme.palette.info.main, 0.2)}
                    />
                    {/* Growth Arrow */}
                    <path
                      d="M 220 60 L 240 40 L 260 60 M 240 40 L 240 80"
                      stroke={theme.palette.success.main}
                      strokeWidth="4"
                      fill="none"
                      strokeLinecap="round"
                    />
                    {/* Dollar Signs */}
                    <text
                      x="90"
                      y="200"
                      fontSize="24"
                      fill={theme.palette.success.main}
                      fontWeight="bold"
                    >
                      $
                    </text>
                    <text
                      x="210"
                      y="200"
                      fontSize="24"
                      fill={theme.palette.success.main}
                      fontWeight="bold"
                    >
                      $
                    </text>
                  </svg>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Container>

      {/* Final CTA Section */}
      {!isAuthenticated && (
        <Box
          sx={{
            bgcolor: alpha(theme.palette.primary.main, 0.05),
            color: 'text.primary',
            py: { xs: 6, md: 10 },
          }}
        >
          <Container maxWidth="md">
            <Box sx={{ textAlign: 'center' }}>
              <Typography
                variant="h3"
                component="h2"
                sx={{
                  fontWeight: 700,
                  mb: 2,
                  fontSize: { xs: '1.75rem', md: '2.5rem' },
                }}
              >
                {t('landing.finalCta.title', 'Ready to Start Shopping?')}
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  mb: 4,
                  fontSize: { xs: '1rem', md: '1.1rem' },
                  lineHeight: 1.6,
                  opacity: 1,
                }}
              >
                {t(
                  'landing.finalCta.subtitle',
                  'Join thousands of satisfied customers shopping and receiving their items quickly and safely across Gabon'
                )}
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ justifyContent: 'center' }}
              >
                <Button
                  variant="contained"
                  size="large"
                  component={RouterLink}
                  to="/items"
                  endIcon={<ArrowForward />}
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'white',
                    px: 5,
                    py: 2,
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    borderRadius: 3,
                    textTransform: 'none',
                    boxShadow: theme.shadows[8],
                    '&:hover': {
                      bgcolor: 'primary.dark',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  {t('landing.finalCta.browseItems', 'Browse Items')}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  component={RouterLink}
                  to="/app"
                  sx={{
                    borderColor: 'primary.main',
                    color: 'text.primary',
                    px: 5,
                    py: 2,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    borderRadius: 3,
                    textTransform: 'none',
                    borderWidth: 2,
                    '&:hover': {
                      borderWidth: 2,
                      bgcolor: 'rgba(255,255,255,0.1)',
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  {t('landing.finalCta.createAccount', 'Create Account')}
                </Button>
              </Stack>
            </Box>
          </Container>
        </Box>
      )}
    </Box>
  );
};

export default LandingPage;
