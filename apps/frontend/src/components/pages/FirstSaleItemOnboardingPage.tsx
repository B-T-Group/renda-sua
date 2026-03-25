import React from 'react';
import { useTranslation } from 'react-i18next';
import FirstSaleItemFlow from '../business/onboarding/first-sale-item/FirstSaleItemFlow';
import SEOHead from '../seo/SEOHead';

const FirstSaleItemOnboardingPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <>
      <SEOHead
        title={t(
          'business.onboarding.firstSale.seoTitle',
          'Add your first product'
        )}
        description={t(
          'business.onboarding.firstSale.seoDescription',
          'Guided setup: upload photos, create your product, add it to a location.'
        )}
        keywords={t('seo.business-dashboard.keywords')}
      />
      <FirstSaleItemFlow />
    </>
  );
};

export default FirstSaleItemOnboardingPage;
