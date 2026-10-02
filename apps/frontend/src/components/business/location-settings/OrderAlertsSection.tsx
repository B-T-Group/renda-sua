import { TextField, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsSection from './SettingsSection';
import { LocationSectionActions } from './sectionTypes';

const OrderAlertsSection: React.FC<LocationSectionActions> = ({
  location,
  updateLocation,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(location.order_alert_phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const summary = location.order_alert_phone
    ? location.order_alert_phone
    : t(
        'business.locations.alerts.empty',
        'Not set — alerts go to you only.'
      );

  const save = async () => {
    const trimmed = phone.trim();
    if (trimmed && !trimmed.startsWith('+')) {
      setError(
        t(
          'business.locations.alerts.countryCode',
          'Enter the number with its country code.'
        )
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateLocation(location.id, {
        order_alert_phone: trimmed || null,
      });
      setEditing(false);
      enqueueSnackbar(
        t('business.locations.alerts.saved', 'Order alerts saved'),
        { variant: 'success' }
      );
    } catch {
      setError(
        t(
          'business.locations.alerts.saveFailed',
          "Couldn't save the alert phone. Please try again."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection
      title={t(
        'business.locations.alerts.label',
        'Extra phone for new-order alerts (optional)'
      )}
      summary={
        <Typography variant="body2" color="text.secondary">
          {summary}
          {' · '}
          {t(
            'business.locations.alerts.help',
            'Add your kitchen or till phone. It gets a message for each new order at this location, and can confirm or update orders from there. You still get your own alerts.'
          )}
        </Typography>
      }
      editing={editing}
      onEdit={() => {
        setPhone(location.order_alert_phone ?? '');
        setEditing(true);
      }}
      onCancel={() => setEditing(false)}
      onSave={() => void save()}
      saveLabel={t('business.locations.alerts.save', 'Save alerts')}
      saving={saving}
      saveDisabled={phone.trim() === (location.order_alert_phone ?? '')}
      error={error}
    >
      <TextField
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder={t('business.locations.alerts.placeholder', '+237 …')}
        fullWidth
      />
      <Typography variant="body2" color="text.secondary">
        {t(
          'business.locations.alerts.help',
          'Add your kitchen or till phone. It gets a message for each new order at this location, and can confirm or update orders from there. You still get your own alerts.'
        )}
      </Typography>
    </SettingsSection>
  );
};

export default OrderAlertsSection;
