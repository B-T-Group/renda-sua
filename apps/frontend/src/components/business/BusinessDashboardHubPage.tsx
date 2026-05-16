import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Container,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import BusinessDashboardModuleCard, {
  BusinessDashboardModule,
} from './BusinessDashboardModuleCard';
import BusinessDashboardSection from './BusinessDashboardSection';
import SEOHead from '../seo/SEOHead';

export interface BusinessDashboardHubSection {
  title: string;
  subtitle?: string;
  modules: BusinessDashboardModule[];
}

export interface BusinessDashboardHubPageProps {
  seoTitleKey: string;
  seoTitleDefault: string;
  seoDescriptionKey: string;
  seoDescriptionDefault: string;
  pageTitle: string;
  pageSubtitle?: string;
  sections: BusinessDashboardHubSection[];
  isLoading: boolean;
  error?: string | null;
  backPath?: string;
}

const BusinessDashboardHubPage: React.FC<BusinessDashboardHubPageProps> = ({
  seoTitleKey,
  seoTitleDefault,
  seoDescriptionKey,
  seoDescriptionDefault,
  pageTitle,
  pageSubtitle,
  sections,
  isLoading,
  error,
  backPath = '/dashboard',
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const renderModules = (modules: BusinessDashboardModule[]) =>
    modules.map((mod) => (
      <BusinessDashboardModuleCard
        key={mod.path}
        module={mod}
        isLoading={isLoading}
      />
    ));

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t(seoTitleKey, seoTitleDefault)}
        description={t(seoDescriptionKey, seoDescriptionDefault)}
        keywords={t('seo.business-dashboard.keywords')}
      />

      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(backPath)}
        sx={{ mb: 2 }}
      >
        {t('business.dashboard.backToDashboard', 'Back to dashboard')}
      </Button>

      <Typography variant="h4" gutterBottom>
        {pageTitle}
      </Typography>
      {pageSubtitle ? (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {pageSubtitle}
        </Typography>
      ) : (
        <Box sx={{ mb: 3 }} />
      )}

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {sections.map((section) => (
        <BusinessDashboardSection
          key={section.title}
          title={section.title}
          subtitle={section.subtitle}
        >
          {renderModules(section.modules)}
        </BusinessDashboardSection>
      ))}
    </Container>
  );
};

export default BusinessDashboardHubPage;
