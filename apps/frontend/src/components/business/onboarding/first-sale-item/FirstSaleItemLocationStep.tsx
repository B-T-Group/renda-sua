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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../../../contexts/UserProfileContext';
import type { AddBusinessLocationData } from '../../../../hooks/useBusinessLocations';
import { useBusinessLocations } from '../../../../hooks/useBusinessLocations';
import { useBusinessInventory } from '../../../../hooks/useBusinessInventory';
import { useItems } from '../../../../hooks/useItems';
import LocationModal from '../../LocationModal';
import type { CreatedSaleItemSummary } from './FirstSaleItemCreateStep';

interface FirstSaleItemLocationStepProps {
  item: CreatedSaleItemSummary;
  onComplete: () => void;
}

const FirstSaleItemLocationStep: React.FC<FirstSaleItemLocationStepProps> = ({
  item,
  onComplete,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
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
    addInventoryItem,
    fetchBusinessLocations,
    loading: invLoading,
  } = useBusinessInventory(businessId);
  const { updateItem } = useItems(businessId);

  const [locationId, setLocationId] = useState('');
  const [qty, setQty] = useState('1');
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
  const price = item.price ?? 0;
  const currency = item.currency || 'XAF';

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
          'business.onboarding.firstSale.location.pickLocation',
          'Select or add a location'
        ),
        { variant: 'warning' }
      );
      return;
    }
    const q = Math.max(0, Number.parseInt(qty, 10) || 0);
    setSaving(true);
    try {
      await addInventoryItem({
        business_location_id: locationId,
        item_id: item.id,
        quantity: q,
        reserved_quantity: 0,
        reorder_point: 0,
        reorder_quantity: 0,
        unit_cost: price,
        selling_price: price,
        is_active: true,
      });
      await updateItem(item.id, { is_active: true });
      enqueueSnackbar(
        t(
          'business.onboarding.firstSale.location.success',
          'Item added to your location'
        ),
        { variant: 'success' }
      );
      onComplete();
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t(
            'business.onboarding.firstSale.location.error',
            'Could not add to location'
          ),
        { variant: 'error' }
      );
    } finally {
      setSaving(false);
    }
  };

  const busy = locLoading || invLoading || saving;

  return (
    <Stack spacing={{ xs: 2.5, sm: 2 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontSize: { xs: '0.95rem', sm: '0.875rem' }, lineHeight: 1.5 }}
      >
        {t(
          'business.onboarding.firstSale.location.hint',
          'Choose where this product is stocked. You can add a new location if needed.'
        )}
      </Typography>
      {!primaryAddressCountry && (
        <Alert severity="warning">
          {t(
            'business.onboarding.firstSale.location.addressFirst',
            'Add a primary business address in your profile before creating locations.'
          )}
        </Alert>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <FormControl fullWidth disabled={busy || !list.length}>
          <InputLabel id="loc-label">
            {t('business.onboarding.firstSale.location.select', 'Location')}
          </InputLabel>
          <Select
            labelId="loc-label"
            label={t('business.onboarding.firstSale.location.select', 'Location')}
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
          fullWidth={isNarrow}
          sx={{ minHeight: 48, flexShrink: 0 }}
        >
          {t(
            'business.onboarding.firstSale.location.addLocation',
            'New location'
          )}
        </Button>
      </Stack>
      <TextField
        label={t('business.onboarding.firstSale.location.quantity', 'Quantity')}
        type="number"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        disabled={busy}
        inputProps={{ min: 0 }}
      />
      <Button
        variant="contained"
        onClick={() => void finish()}
        disabled={busy || !locationId}
        fullWidth={isNarrow}
        size="large"
        sx={{ minHeight: 48 }}
      >
        {t('business.onboarding.firstSale.location.finish', 'Finish')}
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

export default FirstSaleItemLocationStep;
