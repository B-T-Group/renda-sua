import React from 'react';
import { useTranslation } from 'react-i18next';
import FirstSaleItemFlow, {
  type SaleItemFromImageIntent,
} from '../business/onboarding/first-sale-item/FirstSaleItemFlow';
import SEOHead from '../seo/SEOHead';

export interface SaleItemFromImageOnboardingPageProps {
  intent: SaleItemFromImageIntent;
}

/**
 * Guided flow: upload product photos → create item (AI or manual) → add to location.
 * Use `first` for onboarding CTA; `additional` when adding more products from the catalog.
 */
const SaleItemFromImageOnboardingPage: React.FC<
  SaleItemFromImageOnboardingPageProps
> = ({ intent }) => {
  const { t } = useTranslation();
  const isFirst = intent === 'first';

  return (
    <>
      <SEOHead
        title={t(
          isFirst
            ? 'business.onboarding.firstSale.seoTitle'
            : 'business.onboarding.firstSale.seoTitleAdditional',
          isFirst
            ? 'Add your first product'
            : 'Add a product from photos'
        )}
        description={t(
          isFirst
            ? 'business.onboarding.firstSale.seoDescription'
            : 'business.onboarding.firstSale.seoDescriptionAdditional',
          'Upload photos, create your product, add it to a location.'
        )}
        keywords={t(
          isFirst
            ? 'seo.business-dashboard.keywords'
            : 'seo.business-items.keywords'
        )}
      />
      <FirstSaleItemFlow intent={intent} />
    </>
  );
};

export default SaleItemFromImageOnboardingPage;
