import { Button, TextField, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AddressDialog, { AddressFormData } from '../../dialogs/AddressDialog';
import SettingsSection from './SettingsSection';
import { LocationSectionActions } from './sectionTypes';

const BasicsSection: React.FC<LocationSectionActions> = ({
  location,
  updateLocation,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(location.name);
  const [email, setEmail] = useState(location.email ?? '');
  const [logoUrl, setLogoUrl] = useState(location.logo_url ?? '');
  const [showLogoUrl, setShowLogoUrl] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [address, setAddress] = useState<AddressFormData>(toForm(location));

  const save = async () => {
    if (!name.trim()) {
      setNameError(t('business.locations.basics.nameRequired', 'Enter a name.'));
      return;
    }
    setSaving(true);
    setNameError(null);
    setError(null);
    try {
      await updateLocation(location.id, {
        name: name.trim(),
        email: email.trim(),
        logo_url: logoUrl.trim() || null,
      });
      setEditing(false);
      enqueueSnackbar(
        t('business.locations.locationUpdated', 'Location updated successfully'),
        { variant: 'success' }
      );
    } catch {
      setError(
        t(
          'business.locations.basics.saveFailed',
          "Couldn't save this location's name. Please try again."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SettingsSection
        title={t('business.locations.basics.title', 'Name, logo & address')}
        summary={<BasicsSummary location={location} />}
        editing={editing}
        onEdit={() => setEditing(true)}
        onCancel={() => setEditing(false)}
        onSave={() => void save()}
        saveLabel={t('business.locations.basics.save', 'Save details')}
        saving={saving}
        error={error || nameError}
      >
        <TextField
          label={t('business.locations.locationName', 'Location name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={!!nameError}
          helperText={nameError || nameHint(!!logoUrl.trim(), t)}
          fullWidth
        />
        <Typography variant="body2">
          {t('business.locations.basics.logo', 'Logo')}
        </Typography>
        <Button variant="contained" component="label">
          {t('business.locations.basics.uploadLogo', 'Upload a logo')}
          <input
            hidden
            type="file"
            accept="image/*"
            onChange={() =>
              setShowLogoUrl(true)
            }
          />
        </Button>
        <Button variant="text" onClick={() => setShowLogoUrl(true)}>
          {t('business.locations.basics.useLink', 'Use an image link instead')}
        </Button>
        {showLogoUrl ? (
          <TextField
            label={t('business.locations.logoUrl', 'Logo image URL')}
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
            fullWidth
          />
        ) : null}
        {logoUrl ? (
          <Button variant="text" color="inherit" onClick={() => setLogoUrl('')}>
            {t('business.locations.logoClear', 'Remove logo')}
          </Button>
        ) : null}
        <Typography variant="body2" color="text.secondary">
          {t(
            'business.locations.basics.logoHelp',
            'Shown to customers next to this location.'
          )}
        </Typography>
        <TextField
          label={t('business.locations.basics.email', 'Contact email (optional)')}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          helperText={t(
            'business.locations.basics.emailHelp',
            'For messages about this location.'
          )}
          fullWidth
        />
        <Button variant="text" onClick={() => setAddressOpen(true)}>
          {t('business.locations.editAddress', 'Edit address')}
        </Button>
      </SettingsSection>
      <AddressDialog
        open={addressOpen}
        onClose={() => setAddressOpen(false)}
        addressData={address}
        onAddressChange={setAddress}
        onSave={() => {
          void updateLocation(location.id, { address }).then(() => {
            setAddressOpen(false);
          });
        }}
        title={t('business.locations.editLocationAddress', 'Edit location address')}
      />
    </>
  );
};

function BasicsSummary({
  location,
}: {
  location: LocationSectionActions['location'];
}) {
  const { t } = useTranslation();
  const line = [
    location.address?.address_line_1,
    location.address?.city,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Typography variant="body2" color="text.secondary">
      {location.name}
      {line ? ` · ${line}` : ''}
      {location.email
        ? ` · ${t('business.locations.email', 'Email')}: ${location.email}`
        : ''}
    </Typography>
  );
}

function nameHint(
  hasLogo: boolean,
  t: (key: string, fallback: string) => string
): string {
  return hasLogo
    ? t(
        'business.locations.locationNameHintWithLogo',
        'Enter only the city (your logo already shows your business name)'
      )
    : t(
        'business.locations.locationNameHintWithoutLogo',
        'Enter your shop name and the city, e.g. Rendasua – Akwa'
      );
}

function toForm(location: LocationSectionActions['location']): AddressFormData {
  return {
    address_line_1: location.address?.address_line_1 ?? '',
    address_line_2: location.address?.address_line_2 ?? '',
    city: location.address?.city ?? '',
    state: location.address?.state ?? '',
    postal_code: location.address?.postal_code ?? '',
    country: location.address?.country ?? '',
    instructions: location.address?.instructions ?? '',
  };
}

export default BasicsSection;
