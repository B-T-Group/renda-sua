import { Box } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SEOHead } from '../seo';
import { useSEO } from '../../hooks/useSEO';
import {
  AIWorkflow,
  BenefitsGrid,
  ComparisonTable,
  DashboardShowcase,
  FAQ,
  FinalCTA,
  HeroSection,
  LocalContext,
  MerchantJourney,
  MerchantLogos,
  PricingSection,
  SecuritySection,
  SuccessStory,
  TrustMetrics,
} from '../for-business';

const ForBusinessPage: React.FC = () => {
  const { t } = useTranslation();

  const seoConfig = useSEO({
    title: t('forBusiness.seo.title', 'Sell on Rendasua — Open a Business Account'),
    description: t(
      'forBusiness.seo.description',
      'Sell to more local customers without a website. Storefront, payments, AI listings, and delivery — ready in under 5 minutes.'
    ),
    keywords: t(
      'forBusiness.seo.keywords',
      'sell online, business account, local storefront, inventory management, online orders, Rendasua business'
    ),
    type: 'website',
    canonical: 'https://rendasua.com/for-business',
  });

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <SEOHead {...seoConfig} />
      <HeroSection />
      <TrustMetrics />
      <DashboardShowcase />
      <AIWorkflow />
      <BenefitsGrid />
      <ComparisonTable />
      <MerchantJourney />
      <MerchantLogos />
      <SuccessStory />
      <LocalContext />
      <PricingSection />
      <SecuritySection />
      <FAQ />
      <FinalCTA />
    </Box>
  );
};

export default ForBusinessPage;
