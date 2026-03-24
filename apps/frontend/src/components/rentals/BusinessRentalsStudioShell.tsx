import { ArrowBack as ArrowBackIcon, Storefront } from '@mui/icons-material';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../seo/SEOHead';
import BusinessRentalsStudioSubnav from './BusinessRentalsStudioSubnav';

export interface BusinessRentalsStudioShellProps {
  seoTitle: string;
  pageTitle: string;
  pageSubtitle: string;
  children: React.ReactNode;
}

const BusinessRentalsStudioShell: React.FC<BusinessRentalsStudioShellProps> = ({
  seoTitle,
  pageTitle,
  pageSubtitle,
  children,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <>
      <SEOHead title={seoTitle} />
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            mb: 2,
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  flexShrink: 0,
                }}
              >
                <Storefront fontSize="small" />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
                  {pageTitle}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {pageSubtitle}
                </Typography>
              </Box>
            </Stack>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/dashboard')}
              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
            >
              {t('business.rentals.backToDashboard', 'Back to dashboard')}
            </Button>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <BusinessRentalsStudioSubnav />
          <Box sx={{ p: { xs: 2, md: 2.5 } }}>{children}</Box>
        </Paper>
      </Box>
    </>
  );
};

export default BusinessRentalsStudioShell;
