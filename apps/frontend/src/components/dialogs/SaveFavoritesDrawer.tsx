import FavoriteBorderRounded from '@mui/icons-material/FavoriteBorderRounded';
import {
  Box,
  Button,
  Drawer,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthGate } from '../../contexts/AuthGateContext';
import { useAuthFunnelTracking } from '../../hooks/useAuthFunnelTracking';

export interface SaveFavoritesDrawerProps {
  open: boolean;
  onClose: () => void;
  onBeginAuth: () => void;
}

const SaveFavoritesDrawer: React.FC<SaveFavoritesDrawerProps> = ({
  open,
  onClose,
  onBeginAuth,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { flagOn, requireAuth } = useAuthGate();
  const { loginWithRedirectTracked, trackAuthGateDismissed } =
    useAuthFunnelTracking('save_favorites');

  const handleLogin = async () => {
    onBeginAuth();
    if (flagOn) {
      await requireAuth({ context: 'favorites', entry: 'save_favorites' });
      return;
    }
    try {
      await loginWithRedirectTracked('save_favorites', {
        appState: { returnTo: window.location.pathname + window.location.search },
      });
    } catch {
      navigate('/auth/otp');
    }
  };

  const handleSignup = () => {
    onBeginAuth();
    navigate('/signup');
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={() => {
        trackAuthGateDismissed('save_favorites');
        onClose();
      }}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          px: 2.5,
          pt: 2,
          pb: 3,
          maxWidth: 480,
          mx: 'auto',
        },
      }}
    >
      <Stack spacing={2} alignItems="center" textAlign="center">
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            bgcolor: 'error.light',
            color: 'error.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FavoriteBorderRounded />
        </Box>
        <Typography variant="h6" fontWeight={700}>
          {t('items.likes.saveTitle', 'Save your favorites')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(
            'items.likes.saveBenefits',
            'Create an account to keep your likes, get restock alerts, and personalized picks.'
          )}
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ width: '100%', pt: 1 }}>
          <Button fullWidth variant="outlined" onClick={handleLogin}>
            {t('auth.login', 'Sign in')}
          </Button>
          <Button fullWidth variant="contained" onClick={handleSignup}>
            {t('auth.signup', 'Sign up')}
          </Button>
        </Stack>
        <Button
          fullWidth
          color="inherit"
          onClick={() => {
            trackAuthGateDismissed('save_favorites');
            onClose();
          }}
        >
          {t('common.cancel', 'Cancel')}
        </Button>
      </Stack>
    </Drawer>
  );
};

export default SaveFavoritesDrawer;
