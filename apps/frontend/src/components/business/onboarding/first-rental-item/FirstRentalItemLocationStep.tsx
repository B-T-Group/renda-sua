import { Add as AddIcon } from '@mui/icons-material';
import {
  Alert,
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
  onComplete: (savedAsDraft: boolean) => void;
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
  const {
    createBusinessRentalListing,
    publishBusinessRentalListing,
    updateBusinessRentalItem,
    fetchBusinessRentalItem,
  } = useRentalApi();

  const [locationId, setLocationId] = useState('');
  const [pricePerHour, setPricePerHour] = useState('');
  const [pricePerDay, setPricePerDay] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listingIdsByLocation, setListingIdsByLocation] = useState<
    Record<string, string>
  >({});

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

  const parsePrices = (): { hourly: number; daily: number } | null => {
    if (!locationId) {
      enqueueSnackbar(
        t(
          'business.onboarding.firstRental.location.pickLocation',
          'Select or add a location'
        ),
        { variant: 'warning' }
      );
      return null;
    }
    const hourly = Number.parseFloat(pricePerHour.trim());
    if (Number.isNaN(hourly) || hourly < 0) {
      enqueueSnackbar(
        t(
          'business.onboarding.firstRental.location.invalidHourlyPrice',
          'Enter a valid hourly price'
        ),
        { variant: 'warning' }
      );
      return null;
    }
    const dailyRaw = pricePerDay.trim();
    const daily =
      dailyRaw === ''
        ? Number((hourly * 12).toFixed(2))
        : Number.parseFloat(dailyRaw);
    if (Number.isNaN(daily) || daily < 0) {
      enqueueSnackbar(
        t(
          'business.onboarding.firstRental.location.invalidDailyPrice',
          'Enter a valid daily price or leave it empty'
        ),
        { variant: 'warning' }
      );
      return null;
    }
    return { hourly, daily };
  };

  const rememberListingId = (locId: string, listingId: string) => {
    setListingIdsByLocation((prev) => ({ ...prev, [locId]: listingId }));
  };

  const findExistingListingId = async (locId: string): Promise<string | null> => {
    const detail = await fetchBusinessRentalItem(item.id);
    const existing = detail?.rental_location_listings?.find(
      (l) => l.business_location_id === locId && !l.deleted_at
    );
    if (!existing?.id) return null;
    rememberListingId(locId, existing.id);
    return existing.id;
  };

  const ensureListingId = async (
    locId: string,
    hourly: number,
    daily: number
  ): Promise<string> => {
    const cached = listingIdsByLocation[locId];
    if (cached) return cached;
    try {
      const res = await createBusinessRentalListing({
        rental_item_id: item.id,
        business_location_id: locId,
        base_price_per_hour: hourly,
        base_price_per_day: daily,
      });
      if (res?.success && res.data?.id) {
        rememberListingId(locId, res.data.id);
        return res.data.id;
      }
    } catch {
      // Unique constraint or race: reuse existing listing for this location.
    }
    const existingId = await findExistingListingId(locId);
    if (existingId) return existingId;
    throw new Error('Listing failed');
  };

  const finish = async (publish: boolean) => {
    const prices = parsePrices();
    if (!prices) return;
    setSaving(true);
    try {
      const listingId = await ensureListingId(
        locationId,
        prices.hourly,
        prices.daily
      );
      if (publish) {
        const pub = await publishBusinessRentalListing(listingId);
        if (!pub?.success) {
          throw new Error('Publish failed');
        }
      }
      const upd = await updateBusinessRentalItem(item.id, {
        is_active: true,
      });
      if (!upd?.success) {
        throw new Error('Activation failed');
      }
      enqueueSnackbar(
        publish
          ? t(
              'business.onboarding.firstRental.location.publishSuccess',
              'Rental listing submitted for approval'
            )
          : t(
              'business.onboarding.firstRental.location.draftSuccess',
              'Rental listing saved as draft'
            ),
        { variant: 'success' }
      );
      onComplete(!publish);
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
          'Pick where renters pick up the item and set your hourly and daily rates.'
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
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          fullWidth
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
        <TextField
          fullWidth
          label={t(
            'business.onboarding.firstRental.location.pricePerDay',
            'Price per day'
          )}
          type="number"
          value={pricePerDay}
          onChange={(e) => setPricePerDay(e.target.value)}
          disabled={busy}
          inputProps={{ min: 0, step: '0.01' }}
          helperText={t(
            'business.onboarding.firstRental.location.pricePerDayHint',
            'Leave empty to use 12 × hourly rate'
          )}
        />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          variant="contained"
          onClick={() => void finish(true)}
          disabled={busy || !locationId}
        >
          {t(
            'business.onboarding.firstRental.location.publish',
            'Publish rental'
          )}
        </Button>
        <Button
          variant="outlined"
          onClick={() => void finish(false)}
          disabled={busy || !locationId}
        >
          {t(
            'business.onboarding.firstRental.location.saveDraft',
            'Save as draft'
          )}
        </Button>
      </Stack>
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
