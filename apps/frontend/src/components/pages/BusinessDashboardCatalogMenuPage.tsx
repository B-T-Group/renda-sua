import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import BusinessDashboardHubPage from '../business/BusinessDashboardHubPage';
import { useBusinessDashboardModules } from '../../hooks/useBusinessDashboardModules';
import { useDashboardAggregates } from '../../hooks/useDashboardAggregates';

const BusinessDashboardCatalogMenuPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const { aggregates, loading } = useDashboardAggregates(
    profile?.business?.id
  );

  const mainInterest =
    profile?.business?.main_interest ?? 'sell_items';
  const isRentalFocused = mainInterest === 'rent_items';
  const { catalogMenuModules } = useBusinessDashboardModules({
    aggregates,
    isRentalFocused,
  });

  const modules = isRentalFocused
    ? catalogMenuModules
    : [catalogMenuModules[0]];

  return (
    <BusinessDashboardHubPage
      seoTitleKey="business.dashboard.catalogMenuSeoTitle"
      seoTitleDefault="Catalog tools"
      seoDescriptionKey="business.dashboard.catalogMenuSeoDescription"
      seoDescriptionDefault="Image libraries and bulk media for your catalog."
      pageTitle={t('business.dashboard.catalogMenuTitle', 'Catalog tools')}
      pageSubtitle={t(
        'business.dashboard.catalogMenuPageSubtitle',
        'Bulk image upload and organization for your products and rentals.'
      )}
      sections={[
        {
          title: t('business.dashboard.sections.catalog', 'Catalog & locations'),
          subtitle: t(
            'business.dashboard.catalogMenuSectionHint',
            'Media libraries for sale and rental items.'
          ),
          modules,
        },
      ]}
      isLoading={loading}
    />
  );
};

export default BusinessDashboardCatalogMenuPage;
