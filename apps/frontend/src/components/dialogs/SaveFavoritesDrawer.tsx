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
import { useAuth0 } from '@auth0/auth0-react';

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
  const { loginWithRedirect } = useAuth0();

  const handleLogin = async () => {
    onBeginAuth();
    try {
      await loginWithRedirect({
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
      onClose={onClose}
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
        <Button fullWidth color="inherit" onClick={onClose}>
          {t('common.cancel', 'Cancel')}
        </Button>
      </Stack>
    </Drawer>
  );
};

export default SaveFavoritesDrawer;
