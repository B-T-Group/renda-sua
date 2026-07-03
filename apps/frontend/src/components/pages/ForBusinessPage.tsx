import { ArrowForward, AutoAwesome, BarChart, Inventory, LocalShipping, People, Store } from '@mui/icons-material';
import { Box, Button, Card, CardContent, Container, Grid, Stack, Typography, alpha } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { SEOHead } from '../seo';
import { useSEO } from '../../hooks/useSEO';

interface FeatureItem {
  icon: React.ReactNode;
  titleKey: string;
  defaultTitle: string;
  descKey: string;
  defaultDesc: string;
}

const features: FeatureItem[] = [
  { icon: <Store sx={{ fontSize: 28, color: '#16a34a' }} />, titleKey: 'forBusiness.features.storefront.title', defaultTitle: 'Online storefront', descKey: 'forBusiness.features.storefront.desc', defaultDesc: 'Create a professional storefront in minutes. List products, set prices, and start selling to customers in your city.' },
  { icon: <Inventory sx={{ fontSize: 28, color: '#1e40af' }} />, titleKey: 'forBusiness.features.inventory.title', defaultTitle: 'Inventory management', descKey: 'forBusiness.features.inventory.desc', defaultDesc: 'Track stock levels across multiple locations. Get low-inventory alerts before you run out.' },
  { icon: <AutoAwesome sx={{ fontSize: 28, color: '#f59e0b' }} />, titleKey: 'forBusiness.features.ai.title', defaultTitle: 'AI product descriptions', descKey: 'forBusiness.features.ai.desc', defaultDesc: 'Generate compelling, SEO-friendly product descriptions instantly with AI. Save hours of copywriting.' },
  { icon: <LocalShipping sx={{ fontSize: 28, color: '#0891b2' }} />, titleKey: 'forBusiness.features.delivery.title', defaultTitle: 'Delivery management', descKey: 'forBusiness.features.delivery.desc', defaultDesc: 'Manage orders and deliveries from one dashboard. Communicate with delivery agents in real time.' },
  { icon: <People sx={{ fontSize: 28, color: '#8b5cf6' }} />, titleKey: 'forBusiness.features.messaging.title', defaultTitle: 'Customer messaging', descKey: 'forBusiness.features.messaging.desc', defaultDesc: 'Chat directly with your customers and delivery agents through the built-in messaging system.' },
  { icon: <BarChart sx={{ fontSize: 28, color: '#ef4444' }} />, titleKey: 'forBusiness.features.analytics.title', defaultTitle: 'Business analytics', descKey: 'forBusiness.features.analytics.desc', defaultDesc: 'Track revenue, orders, and performance metrics. Understand your best-selling products and busiest periods.' },
];

const howToStart = [
  { step: '1', titleKey: 'forBusiness.steps.signup.title', defaultTitle: 'Create your account', descKey: 'forBusiness.steps.signup.desc', defaultDesc: 'Sign up for a free business account on rendasua.com in under 2 minutes.' },
  { step: '2', titleKey: 'forBusiness.steps.add.title', defaultTitle: 'Add your products', descKey: 'forBusiness.steps.add.desc', defaultDesc: 'Upload photos, set prices, and let AI write your product descriptions.' },
  { step: '3', titleKey: 'forBusiness.steps.sell.title', defaultTitle: 'Start selling', descKey: 'forBusiness.steps.sell.desc', defaultDesc: 'Your storefront goes live and customers can start ordering right away.' },
];

const ForBusinessPage: React.FC = () => {
  const { t } = useTranslation();
  const shouldReduce = useReducedMotion();

  const seoConfig = useSEO({
    title: t('forBusiness.seo.title', 'Sell on Rendasua — Open a Business Account'),
    description: t('forBusiness.seo.description', 'Create an online storefront, manage inventory, and reach customers in your city. Join hundreds of local businesses already selling on Rendasua.'),
    keywords: t('forBusiness.seo.keywords', 'sell online, business account, local storefront, inventory management, online orders, Rendasua business'),
    type: 'website',
    canonical: 'https://rendasua.com/for-business',
  });

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <SEOHead {...seoConfig} />

      {/* Hero */}
      <Box
        component="section"
        sx={{
          background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 70%, #059669 100%)',
          position: 'relative',
          overflow: 'hidden',
          py: { xs: 10, md: 16 },
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at 70% 30%, rgba(16,185,129,0.2) 0%, transparent 55%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ maxWidth: 680, mx: 'auto', textAlign: 'center' }}>
            <motion.div initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
              <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700, letterSpacing: '0.12em', mb: 2, display: 'block' }}>
                {t('forBusiness.hero.eyebrow', 'For businesses')}
              </Typography>
              <Typography component="h1" sx={{ fontSize: { xs: '2.5rem', md: '3.75rem' }, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, color: '#fff', mb: 3 }}>
                {t('forBusiness.hero.headline', 'Your storefront, online in minutes.')}
              </Typography>
              <Typography variant="h6" component="p" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 400, mb: 5, lineHeight: 1.65 }}>
                {t('forBusiness.hero.subheadline', 'Join hundreds of local businesses already selling on Rendasua. Set up your storefront, manage inventory with AI, and connect directly with customers and delivery agents.')}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                <Button
                  component={RouterLink}
                  to="/signup?intent=business_sell"
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForward />}
                  sx={{ bgcolor: 'white', color: '#16a34a', fontWeight: 700, px: 4, '&:hover': { bgcolor: 'grey.50' } }}
                >
                  {t('forBusiness.hero.cta', 'Create Business Account')}
                </Button>
                <Button
                  component={RouterLink}
                  to="/signup?intent=business_rent"
                  variant="outlined"
                  size="large"
                  sx={{ borderColor: 'rgba(255,255,255,0.5)', color: '#fff', fontWeight: 600, borderWidth: 2, '&:hover': { borderColor: '#fff', borderWidth: 2 } }}
                >
                  {t('forBusiness.hero.rentalCta', 'Open Rental Account')}
                </Button>
              </Stack>
            </motion.div>
          </Box>
        </Container>
      </Box>

      {/* Features */}
      <Box component="section" sx={{ py: { xs: 8, md: 14 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography component="h2" sx={{ fontSize: { xs: '1.875rem', md: '2.5rem' }, fontWeight: 800, letterSpacing: '-0.025em', mb: 2 }}>
              {t('forBusiness.features.title', 'Everything you need to grow')}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 500, mx: 'auto' }}>
              {t('forBusiness.features.subtitle', 'A complete toolkit for local businesses — from storefront to analytics.')}
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {features.map((f, i) => (
              <Grid key={f.titleKey} size={{ xs: 12, sm: 6, md: 4 }}>
                <motion.div
                  initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  style={{ height: '100%' }}
                >
                  <Card elevation={0} sx={{ height: '100%', border: '1.5px solid', borderColor: 'divider', borderRadius: 3, transition: 'all 0.25s ease', '&:hover': { borderColor: '#16a34a', boxShadow: '0 8px 24px rgba(22,163,74,0.12)' } }}>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ width: 52, height: 52, borderRadius: 2, bgcolor: alpha('#16a34a', 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                        {f.icon}
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{t(f.titleKey, f.defaultTitle)}</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>{t(f.descKey, f.defaultDesc)}</Typography>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* How to start */}
      <Box component="section" sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.paper' }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography component="h2" sx={{ fontSize: { xs: '1.875rem', md: '2.5rem' }, fontWeight: 800, letterSpacing: '-0.025em', mb: 2 }}>
              {t('forBusiness.steps.title', 'Get started in 3 steps')}
            </Typography>
          </Box>
          <Grid container spacing={4}>
            {howToStart.map((s, i) => (
              <Grid key={s.step} size={{ xs: 12, md: 4 }}>
                <motion.div
                  initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                >
                  <Box sx={{ textAlign: 'center' }}>
                    <Box sx={{ width: 52, height: 52, borderRadius: '50%', bgcolor: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.25rem', mx: 'auto', mb: 2 }}>
                      {s.step}
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{t(s.titleKey, s.defaultTitle)}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>{t(s.descKey, s.defaultDesc)}</Typography>
                  </Box>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Final CTA */}
      <Box component="section" sx={{ py: { xs: 8, md: 12 }, bgcolor: alpha('#16a34a', 0.05) }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center' }}>
            <Typography component="h2" sx={{ fontSize: { xs: '1.875rem', md: '2.5rem' }, fontWeight: 800, letterSpacing: '-0.02em', mb: 2 }}>
              {t('forBusiness.cta.title', 'Ready to grow your business?')}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
              {t('forBusiness.cta.subtitle', 'Join the Rendasua marketplace today. It takes less than 5 minutes to set up your storefront.')}
            </Typography>
            <Button
              component={RouterLink}
              to="/signup?intent=business_sell"
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
              sx={{ bgcolor: '#16a34a', fontWeight: 700, px: 5, py: 1.5, '&:hover': { bgcolor: '#15803d' } }}
            >
              {t('forBusiness.cta.button', 'Create Business Account')}
            </Button>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default ForBusinessPage;
