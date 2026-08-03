import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { firstItemOnboardingPath } from '../../utils/businessSetup';
import { GoLiveCelebrationIllustration } from '../illustrations/GoLiveCelebrationIllustration';

export interface BusinessGoLiveCelebrationProps {
  open: boolean;
  businessId: string;
  mainInterest: 'sell_items' | 'rent_items';
  onDismiss: () => void;
}

export const BusinessGoLiveCelebration: React.FC<
  BusinessGoLiveCelebrationProps
> = ({ open, businessId, mainInterest, onDismiss }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isRental = mainInterest === 'rent_items';
  const addPath = firstItemOnboardingPath(mainInterest);

  const goPreview = () => {
    onDismiss();
    navigate(`/store/${businessId}?preview=1`);
  };

  const goAddProduct = () => {
    onDismiss();
    navigate(addPath);
  };

  return (
    <Dialog
      open={open}
      onClose={onDismiss}
      maxWidth="sm"
      fullWidth
      aria-labelledby="go-live-celebration-title"
    >
      <DialogTitle id="go-live-celebration-title" sx={{ textAlign: 'center', pt: 3 }}>
        {t('business.goLive.title', 'Your store is live!')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} alignItems="center" sx={{ pb: 1 }}>
          <GoLiveCelebrationIllustration
            label={t('business.goLive.illustrationLabel', 'Store is live')}
          />
          <Typography variant="body1" color="text.secondary" textAlign="center">
            {isRental
              ? t(
                  'business.goLive.bodyRental',
                  'Customers can discover your rentals and request bookings. Keep your catalog fresh and share your store.'
                )
              : t(
                  'business.goLive.body',
                  'Customers can discover your products and place orders. Keep your catalog fresh and share your store.'
                )}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          flexDirection: { xs: 'column', sm: 'row' },
          px: 3,
          pb: 3,
          gap: 1,
        }}
      >
        <Button variant="outlined" onClick={goPreview} fullWidth>
          {t('stores.previewCtaButton', 'Preview store')}
        </Button>
        <Button variant="outlined" onClick={goAddProduct} fullWidth>
          {isRental
            ? t('business.goLive.ctaAddRental', 'Add a rental')
            : t('business.goLive.ctaAddProduct', 'Add a product')}
        </Button>
        <Button variant="contained" onClick={onDismiss} fullWidth>
          {t('business.goLive.ctaContinue', 'Continue to dashboard')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
