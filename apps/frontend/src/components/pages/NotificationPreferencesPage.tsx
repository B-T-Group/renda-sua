import {
  Alert,
  Box,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  useNotificationPreferences,
  type NotificationPreferencesPatch,
} from '../../hooks/useNotificationPreferences';

const NotificationPreferencesPage: React.FC = () => {
  const { t } = useTranslation();
  const { prefs, loading, saving, error, update } = useNotificationPreferences();

  const onToggle = async (
    key: keyof NotificationPreferencesPatch,
    value: boolean
  ) => {
    try {
      await update({ [key]: value });
    } catch {
      // error surfaced via hook state
    }
  };

  if (loading || !prefs) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  const waDisabledReason =
    !prefs.phoneNumberVerified || !prefs.phoneNumber
      ? t(
          'notifications.preferences.whatsappNeedsPhone',
          'Verify your phone number in Profile before enabling WhatsApp.'
        )
      : null;

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        {t('notifications.preferences.title', 'Notification preferences')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t(
          'notifications.preferences.subtitle',
          'Choose how Rendasua reaches you for orders, chat, and updates.'
        )}
      </Typography>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      {waDisabledReason ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {waDisabledReason}
        </Alert>
      ) : null}

      <Stack spacing={1}>
        <Typography variant="subtitle2" color="text.secondary">
          {t('notifications.preferences.channels', 'Channels')}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={prefs.pushEnabled}
              disabled={saving}
              onChange={(_, v) => void onToggle('pushEnabled', v)}
            />
          }
          label={t('notifications.preferences.push', 'Push notifications')}
        />
        <FormControlLabel
          control={
            <Switch
              checked={prefs.emailEnabled}
              disabled={saving}
              onChange={(_, v) => void onToggle('emailEnabled', v)}
            />
          }
          label={t('notifications.preferences.email', 'Email')}
        />
        <FormControlLabel
          control={
            <Switch
              checked={prefs.smsEnabled}
              disabled={saving}
              onChange={(_, v) => void onToggle('smsEnabled', v)}
            />
          }
          label={t('notifications.preferences.sms', 'SMS (fallback)')}
        />
        <FormControlLabel
          control={
            <Switch
              checked={prefs.whatsappEnabled}
              disabled={saving || !!waDisabledReason}
              onChange={(_, v) => void onToggle('whatsappEnabled', v)}
            />
          }
          label={t('notifications.preferences.whatsapp', 'WhatsApp')}
        />
        <FormControlLabel
          control={
            <Switch
              checked={prefs.whatsappInformationalEnabled}
              disabled={saving || !prefs.whatsappEnabled}
              onChange={(_, v) =>
                void onToggle('whatsappInformationalEnabled', v)
              }
            />
          }
          label={t(
            'notifications.preferences.whatsappInformational',
            'WhatsApp tips & digests (optional)'
          )}
        />

        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" color="text.secondary">
          {t('notifications.preferences.categories', 'Categories')}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={prefs.orderUpdates}
              disabled={saving}
              onChange={(_, v) => void onToggle('orderUpdates', v)}
            />
          }
          label={t('notifications.preferences.orderUpdates', 'Order updates')}
        />
        <FormControlLabel
          control={
            <Switch
              checked={prefs.chat}
              disabled={saving}
              onChange={(_, v) => void onToggle('chat', v)}
            />
          }
          label={t('notifications.preferences.chat', 'Chat & mentions')}
        />
        <FormControlLabel
          control={
            <Switch
              checked={prefs.marketplace}
              disabled={saving}
              onChange={(_, v) => void onToggle('marketplace', v)}
            />
          }
          label={t('notifications.preferences.marketplace', 'Marketplace')}
        />
        <FormControlLabel
          control={
            <Switch
              checked={prefs.reminders}
              disabled={saving}
              onChange={(_, v) => void onToggle('reminders', v)}
            />
          }
          label={t('notifications.preferences.reminders', 'Reminders')}
        />
        <FormControlLabel
          control={
            <Switch
              checked={prefs.marketingEnabled}
              disabled={saving}
              onChange={(_, v) => void onToggle('marketingEnabled', v)}
            />
          }
          label={t('notifications.preferences.marketing', 'Marketing')}
        />
      </Stack>
    </Container>
  );
};

export default NotificationPreferencesPage;
