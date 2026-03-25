import { Add as AddIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../../../contexts/UserProfileContext';
import type { AddBusinessLocationData } from '../../../../hooks/useBusinessLocations';
import { useBusinessLocations } from '../../../../hooks/useBusinessLocations';
import { useBusinessInventory } from '../../../../hooks/useBusinessInventory';
import { useRentalApi } from '../../../../hooks/useRentalApi';
import LocationModal from '../../LocationModal';
import type { CreatedRentalItemSummary } from './FirstRentalItemCreateStep';

interface FirstRentalItemLocationStepProps {
  item: CreatedRentalItemSummary;
  onComplete: () => void;
}

const FirstRentalItemLocationStep: React.FC<
  FirstRentalItemLocationStepProps
> = ({ item, onComplete }) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile, refetch: refetchProfile } = useUserProfileContext();
  const businessId = profile?.business?.id;
  const {
    locations,
    primaryAddressCountry,
    addLocation,
    fetchLocations,
    loading: locLoading,
  } = useBusinessLocations(businessId, undefined, refetchProfile);
  const {
    businessLocations,
    fetchBusinessLocations,
    loading: invLoading,
  } = useBusinessInventory(businessId);
  const { createBusinessRentalListing, updateBusinessRentalItem } =
    useRentalApi();

  const [locationId, setLocationId] = useState('');
  const [pricePerHour, setPricePerHour] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    void fetchLocations();
    void fetchBusinessLocations();
  }, [businessId, fetchLocations, fetchBusinessLocations]);

  useEffect(() => {
    const list = businessLocations.length ? businessLocations : locations;
    if (!locationId && list.length) {
      setLocationId(list[0].id);
    }
  }, [businessLocations, locations, locationId]);

  const list = businessLocations.length ? businessLocations : locations;

  const saveLocation = async (data: AddBusinessLocationData) => {
    const created = await addLocation(data);
    await fetchBusinessLocations();
    await fetchLocations();
    if (created?.id) setLocationId(created.id);
    setModalOpen(false);
  };

  const finish = async () => {
    if (!locationId) {
      enqueueSnackbar(
        t(
          'business.onboarding.firstRental.location.pickLocation',
          'Select or add a location'
        ),
        { variant: 'warning' }
      );
      return;
    }
    const rate = Number.parseFloat(pricePerHour.trim());
    if (Number.isNaN(rate) || rate < 0) {
      enqueueSnackbar(
        t(
          'business.onboarding.firstRental.location.invalidPrice',
          'Enter a valid hourly price'
        ),
        { variant: 'warning' }
      );
      return;
    }
    setSaving(true);
    try {
      const dayRate = Number((rate * 12).toFixed(2));
      const res = await createBusinessRentalListing({
        rental_item_id: item.id,
        business_location_id: locationId,
        base_price_per_hour: rate,
        base_price_per_day: dayRate,
      });
      if (!res?.success) {
        throw new Error('Listing failed');
      }
      const upd = await updateBusinessRentalItem(item.id, {
        is_active: true,
      });
      if (!upd?.success) {
        throw new Error('Activation failed');
      }
      enqueueSnackbar(
        t(
          'business.onboarding.firstRental.location.success',
          'Rental listing created'
        ),
        { variant: 'success' }
      );
      onComplete();
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t(
            'business.onboarding.firstRental.location.error',
            'Could not create listing'
          ),
        { variant: 'error' }
      );
    } finally {
      setSaving(false);
    }
  };

  const busy = locLoading || invLoading || saving;

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t(
          'business.onboarding.firstRental.location.hint',
          'Pick where renters pick up the item and set your hourly rate.'
        )}
      </Typography>
      {!primaryAddressCountry && (
        <Alert severity="warning">
          {t(
            'business.onboarding.firstRental.location.addressFirst',
            'Add a primary business address before creating locations.'
          )}
        </Alert>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <FormControl fullWidth disabled={busy || !list.length}>
          <InputLabel id="rloc">
            {t('business.onboarding.firstRental.location.select', 'Location')}
          </InputLabel>
          <Select
            labelId="rloc"
            label={t('business.onboarding.firstRental.location.select', 'Location')}
            value={locationId}
            onChange={(e) => setLocationId(e.target.value as string)}
          >
            {list.map((loc: { id: string; name: string }) => (
              <MenuItem key={loc.id} value={loc.id}>
                {loc.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setModalOpen(true)}
          disabled={busy || !primaryAddressCountry}
        >
          {t(
            'business.onboarding.firstRental.location.addLocation',
            'New location'
          )}
        </Button>
      </Stack>
      <TextField
        label={t(
          'business.onboarding.firstRental.location.pricePerHour',
          'Price per hour'
        )}
        type="number"
        value={pricePerHour}
        onChange={(e) => setPricePerHour(e.target.value)}
        disabled={busy}
        inputProps={{ min: 0, step: '0.01' }}
      />
      <Button
        variant="contained"
        onClick={() => void finish()}
        disabled={busy || !locationId}
      >
        {t('business.onboarding.firstRental.location.finish', 'Finish')}
      </Button>
      <LocationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={saveLocation}
        businessPrimaryCountry={primaryAddressCountry}
        loading={locLoading}
      />
    </Stack>
  );
};

export default FirstRentalItemLocationStep;
