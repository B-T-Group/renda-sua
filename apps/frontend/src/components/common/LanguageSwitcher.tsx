import { Language } from '@mui/icons-material';
import { Box, Button, Menu, MenuItem, Typography } from '@mui/material';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import { useUserProfileContext } from '../../contexts/UserProfileContext';

const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();
  const apiClient = useApiClient();
  const { profile, refetch } = useUserProfileContext();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const changeLanguage = useCallback(
    async (lng: string) => {
      i18n.changeLanguage(lng);
      handleClose();
      if (apiClient && profile && (lng === 'en' || lng === 'fr')) {
        try {
          await apiClient.post('/users/me/update', {
            firstName: profile.first_name,
            lastName: profile.last_name,
            phoneNumber: profile.phone_number,
            preferredLanguage: lng as 'en' | 'fr',
          });
          await refetch();
        } catch {
          // Keep UI language change even if save fails
        }
      }
    },
    [i18n, apiClient, profile, refetch]
  );

  const getCurrentLanguageName = () => {
    switch (i18n.language) {
      case 'fr':
        return 'Français';
      case 'en':
      default:
        return 'English';
    }
  };

  return (
    <Box>
      <Button
        onClick={handleClick}
        startIcon={<Language />}
        sx={{
          color: '#1e40af',
          textTransform: 'none',
          '&:hover': {
            backgroundColor: 'rgba(30, 64, 175, 0.1)',
          },
        }}
      >
        <Typography variant="body2" sx={{ color: '#1e40af', fontWeight: 500 }}>
          {getCurrentLanguageName()}
        </Typography>
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => changeLanguage('en')}>English</MenuItem>
        <MenuItem onClick={() => changeLanguage('fr')}>Français</MenuItem>
      </Menu>
    </Box>
  );
};

export default LanguageSwitcher;
