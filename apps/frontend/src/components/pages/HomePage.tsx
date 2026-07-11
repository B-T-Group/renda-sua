import { Box } from '@mui/material';
import React, { lazy, Suspense, useEffect } from 'react';
import { SEOHead } from '../seo';
import { useSEO } from '../../hooks/useSEO';
import { useTranslation } from 'react-i18next';
import { APP_STORE_URL, PLAY_STORE_URL } from '../../hooks/useAppStoreLinks';
import { useHomeAnalytics } from '../../hooks/useHomeAnalytics';

const STRUCTURED_DATA_ID = 'home-software-app-schema';

function useHomeStructuredData() {
  useEffect(() => {
    if (document.getElementById(STRUCTURED_DATA_ID)) return;
    const script = document.createElement('script');
    script.id = STRUCTURED_DATA_ID;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify([
      {
        '@context': 'https://schema.org',
        '@type': 'MobileApplication',
        name: 'Rendasua',
        description: 'Local marketplace app for buying and renting — connecting shoppers, local businesses, and delivery agents.',
        applicationCategory: 'ShoppingApplication',
        operatingSystem: 'iOS, Android',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        installUrl: [APP_STORE_URL, PLAY_STORE_URL],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: 'What is Rendasua?', acceptedAnswer: { '@type': 'Answer', text: 'Rendasua is a local marketplace for buying and renting. Want to own something? We have your back. Just want to rent it? We still have your back — with delivery to your door.' } },
          { '@type': 'Question', name: 'How do I place an order?', acceptedAnswer: { '@type': 'Answer', text: 'Download the Rendasua app, browse products or rentals from local businesses near you, and checkout in minutes.' } },
          { '@type': 'Question', name: 'How do I start selling as a business?', acceptedAnswer: { '@type': 'Answer', text: 'Create a free business account on rendasua.com, set up your storefront, list products and rentals, and start receiving orders.' } },
        ],
      },
    ]);
    document.head.appendChild(script);
    return () => { const el = document.getElementById(STRUCTURED_DATA_ID); if (el) el.remove(); };
  }, []);
}

// Above-the-fold: import directly (ships in main chunk)
import HeroSection from '../home/HeroSection';
import TrustStripSection from '../home/TrustStripSection';

// Below-the-fold: lazy-loaded for bundle splitting
const MarketplaceOverviewSection = lazy(() => import('../home/MarketplaceOverviewSection'));
const HowItWorksStorySection = lazy(() => import('../home/HowItWorksStorySection'));
const PersonaSection = lazy(() => import('../home/PersonaSection'));
const PlatformFeaturesSection = lazy(() => import('../home/PlatformFeaturesSection'));
const BrowseProductsPreviewSection = lazy(() => import('../home/BrowseProductsPreviewSection'));
const BusinessGrowthSection = lazy(() => import('../home/BusinessGrowthSection'));
const BecomeAgentSection = lazy(() => import('../home/BecomeAgentSection'));
const DownloadAppSection = lazy(() => import('../home/DownloadAppSection'));
const HomeFaqSection = lazy(() => import('../home/HomeFaqSection'));

const SectionFallback: React.FC = () => (
  <Box sx={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
);

const HomePage: React.FC = () => {
  const { t } = useTranslation();

  useHomeStructuredData();
  useHomeAnalytics();

  const seoConfig = useSEO({
    title: t('home.seo.title', 'Rendasua — Own It or Rent It, Locally'),
    description: t(
      'home.seo.description',
      "Want to own something? Rendasua's got your back. Just want to rent it? We've still got your back. Shop or rent from local businesses and track every delivery in real time."
    ),
    keywords: t(
      'home.seo.keywords',
      'local delivery app, marketplace, online shopping, rentals, rent locally, delivery agent, business storefront, Rendasua app, download Rendasua'
    ),
    type: 'website',
    canonical: 'https://rendasua.com/',
  });

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <SEOHead {...seoConfig} />

      {/* === ABOVE THE FOLD === */}
      <HeroSection />
      <TrustStripSection />

      {/* === BELOW THE FOLD — lazy-mounted === */}
      <Suspense fallback={<SectionFallback />}>
        <MarketplaceOverviewSection />
      </Suspense>

      <Suspense fallback={<SectionFallback />}>
        <HowItWorksStorySection />
      </Suspense>

      <Suspense fallback={<SectionFallback />}>
        <PersonaSection />
      </Suspense>

      <Suspense fallback={<SectionFallback />}>
        <PlatformFeaturesSection />
      </Suspense>

      <Suspense fallback={<SectionFallback />}>
        <BrowseProductsPreviewSection />
      </Suspense>

      <Suspense fallback={<SectionFallback />}>
        <BusinessGrowthSection />
      </Suspense>

      <Suspense fallback={<SectionFallback />}>
        <BecomeAgentSection />
      </Suspense>

      <Suspense fallback={<SectionFallback />}>
        <DownloadAppSection />
      </Suspense>

      <Suspense fallback={<SectionFallback />}>
        <HomeFaqSection />
      </Suspense>
    </Box>
  );
};

export default HomePage;
