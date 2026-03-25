import { ArrowForward as ArrowIcon } from '@mui/icons-material';
import { Box, Button, Card, CardContent, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';

export type FirstItemCtaVariant = 'sale' | 'rental';

interface BusinessDashboardFirstItemCtaProps {
  variant: FirstItemCtaVariant;
}

const BusinessDashboardFirstItemCta: React.FC<
  BusinessDashboardFirstItemCtaProps
> = ({ variant }) => {
  const { t } = useTranslation();
  const isSale = variant === 'sale';
  const to = isSale
    ? '/business/onboarding/first-sale-item'
    : '/business/onboarding/add-rental-item';
  return (
    <Card
      elevation={0}
      sx={{
        mb: 3,
        border: 1,
        borderColor: 'primary.light',
        borderRadius: 2,
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
      }}
    >
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h6" gutterBottom>
              {isSale
                ? t(
                    'business.dashboard.firstItem.saleTitle',
                    'Add your first product'
                  )
                : t(
                    'business.dashboard.firstItem.rentalTitle',
                    'Add your first rental item'
                  )}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isSale
                ? t(
                    'business.dashboard.firstItem.saleBody',
                    'Upload photos, create your item with AI or manually, then add it to a location so customers can buy.'
                  )
                : t(
                    'business.dashboard.firstItem.rentalBody',
                    'Upload photos, create your rental with AI or manually, then publish it at a location.'
                  )}
            </Typography>
          </Box>
          <Button
            component={RouterLink}
            to={to}
            variant="contained"
            size="large"
            endIcon={<ArrowIcon />}
            sx={{ flexShrink: 0 }}
          >
            {isSale
              ? t(
                  'business.dashboard.firstItem.saleCta',
                  'Start guided setup'
                )
              : t(
                  'business.dashboard.firstItem.rentalCta',
                  'Start guided setup'
                )}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default BusinessDashboardFirstItemCta;
