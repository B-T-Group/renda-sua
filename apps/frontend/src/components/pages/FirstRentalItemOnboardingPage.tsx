import React from 'react';
import { useTranslation } from 'react-i18next';
import FirstRentalItemFlow from '../business/onboarding/first-rental-item/FirstRentalItemFlow';
import SEOHead from '../seo/SEOHead';

const FirstRentalItemOnboardingPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <>
      <SEOHead
        title={t(
          'business.onboarding.firstRental.seoTitle',
          'Add your first rental'
        )}
        description={t(
          'business.onboarding.firstRental.seoDescription',
          'Guided setup: upload photos, create your rental, publish at a location.'
        )}
        keywords={t('seo.business-dashboard.keywords')}
      />
      <FirstRentalItemFlow />
    </>
  );
};

export default FirstRentalItemOnboardingPage;
