import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import BusinessDashboardHubPage from '../business/BusinessDashboardHubPage';
import { useBusinessDashboardModules } from '../../hooks/useBusinessDashboardModules';
import { useDashboardAggregates } from '../../hooks/useDashboardAggregates';

const BusinessDashboardMorePage: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const {
    aggregates,
    loading,
    error: aggregatesError,
  } = useDashboardAggregates(profile?.business?.id);

  const mainInterest =
    profile?.business?.main_interest ?? 'sell_items';
  const isRentalFocused = mainInterest === 'rent_items';

  const {
    morePageOrderModules,
    rentalModules,
    insightModules,
  } = useBusinessDashboardModules({ aggregates, isRentalFocused });

  const sections = [
    {
      title: t(
        'business.dashboard.sections.ordersAndDelivery',
        'Orders & delivery'
      ),
      subtitle: t(
        'business.dashboard.moreOrdersSectionHint',
        'Additional order workflows beyond day-to-day fulfillment.'
      ),
      modules: morePageOrderModules,
    },
    {
      title: t('business.dashboard.sections.rentals', 'Rentals'),
      subtitle: t(
        'business.dashboard.sections.rentalsHint',
        'Rental catalog, client requests, and schedule.'
      ),
      modules: rentalModules,
    },
    {
      title: t(
        'business.dashboard.sections.insights',
        'Insights & records'
      ),
      subtitle: t(
        'business.dashboard.sections.insightsHint',
        'Analytics and business documents.'
      ),
      modules: insightModules,
    },
  ];

  return (
    <BusinessDashboardHubPage
      seoTitleKey="business.dashboard.morePageSeoTitle"
      seoTitleDefault="More business tools"
      seoDescriptionKey="business.dashboard.morePageSeoDescription"
      seoDescriptionDefault="Refund requests, batch orders, rentals, and analytics."
      pageTitle={t('business.dashboard.morePageTitle', 'More tools')}
      pageSubtitle={t(
        'business.dashboard.morePageSubtitle',
        'Additional workflows that are not needed on every visit.'
      )}
      sections={sections}
      isLoading={loading}
      error={aggregatesError}
    />
  );
};

export default BusinessDashboardMorePage;
