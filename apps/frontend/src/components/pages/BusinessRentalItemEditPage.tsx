import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  useRentalApi,
  type BusinessRentalItemDetail,
  type BusinessRentalListingDetail,
  type UpdateBusinessRentalItemBody,
  type UpdateBusinessRentalListingBody,
} from '../../hooks/useRentalApi';
import { useRentalCategories } from '../../hooks/useRentalCategories';
import LoadingPage from '../common/LoadingPage';
import SEOHead from '../seo/SEOHead';

interface ListingFormState {
  base_price_per_day: string;
  min_rental_days: string;
  max_rental_days: string;
  units_available: string;
  pickup_instructions: string;
  dropoff_instructions: string;
  is_active: boolean;
}

function listingFormsFromDetail(
  item: BusinessRentalItemDetail
): Record<string, ListingFormState> {
  const out: Record<string, ListingFormState> = {};
  for (const l of item.rental_location_listings) {
    out[l.id] = {
      base_price_per_day: String(l.base_price_per_day),
      min_rental_days: String(l.min_rental_days),
      max_rental_days: l.max_rental_days != null ? String(l.max_rental_days) : '',
      units_available: String(l.units_available),
      pickup_instructions: l.pickup_instructions ?? '',
      dropoff_instructions: l.dropoff_instructions ?? '',
      is_active: l.is_active,
    };
  }
  return out;
}

function buildItemUpdateBody(
  name: string,
  desc: string,
  cat: string,
  tagsCsv: string,
  currency: string,
  itemActive: boolean
): UpdateBusinessRentalItemBody {
  return {
    name: name.trim(),
    description: desc.trim(),
    rental_category_id: cat,
    tags: tagsCsv
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
    currency: currency.trim() || 'XAF',
    is_active: itemActive,
  };
}

function buildListingUpdateBody(
  f: ListingFormState
): UpdateBusinessRentalListingBody | null {
  const parsed = parsePriceFields(f);
  if (!parsed) return null;
  return {
    ...parsed,
    pickup_instructions: f.pickup_instructions.trim(),
    dropoff_instructions: f.dropoff_instructions.trim(),
    is_active: f.is_active,
  };
}

function parsePriceFields(f: ListingFormState): {
  base_price_per_day: number;
  min_rental_days: number;
  max_rental_days: number | null;
  units_available: number;
} | null {
  const base = Number(f.base_price_per_day);
  const minD = Number(f.min_rental_days);
  const maxRaw = f.max_rental_days.trim();
  const maxD = maxRaw === '' ? null : Number(maxRaw);
  const units = Number(f.units_available);
  if (Number.isNaN(base) || base < 0) return null;
  if (Number.isNaN(minD) || minD < 1) return null;
  if (maxD !== null && (Number.isNaN(maxD) || maxD < 1)) return null;
  if (maxD !== null && maxD < minD) return null;
  if (Number.isNaN(units) || units < 1) return null;
  return {
    base_price_per_day: base,
    min_rental_days: minD,
    max_rental_days: maxD,
    units_available: units,
  };
}

const BusinessRentalItemEditPage: React.FC = () => {
  const { t } = useTranslation();
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfileContext();
  const businessId = profile?.business?.id;
  const { categories } = useRentalCategories();
  const {
    fetchBusinessRentalItem,
    updateBusinessRentalItem,
    updateBusinessRentalListing,
  } = useRentalApi();

  const [item, setItem] = useState<BusinessRentalItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('');
  const [tags, setTags] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [itemActive, setItemActive] = useState(true);
  const [listingForms, setListingForms] = useState<Record<string, ListingFormState>>(
    {}
  );
  const [savingItem, setSavingItem] = useState(false);
  const [savingListingId, setSavingListingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!itemId) return;
    const next = await fetchBusinessRentalItem(itemId);
    setItem(next);
    if (next) {
      setName(next.name);
      setDesc(next.description ?? '');
      setCat(next.rental_category_id);
      setTags((next.tags ?? []).join(', '));
      setCurrency(next.currency);
      setItemActive(next.is_active);
      setListingForms(listingFormsFromDetail(next));
    }
  }, [fetchBusinessRentalItem, itemId]);

  useEffect(() => {
    if (!businessId || !itemId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void reload().finally(() => setLoading(false));
  }, [businessId, itemId, reload]);

  const patchListingForm = useCallback(
    (listingId: string, patch: Partial<ListingFormState>) => {
      setListingForms((prev) => ({
        ...prev,
        [listingId]: { ...prev[listingId], ...patch },
      }));
    },
    []
  );

  const saveItem = useCallback(async () => {
    if (!itemId || !name.trim()) {
      enqueueSnackbar(t('business.rentals.nameRequired', 'Name is required'), {
        variant: 'warning',
      });
      return;
    }
    setSavingItem(true);
    try {
      const body = buildItemUpdateBody(name, desc, cat, tags, currency, itemActive);
      await updateBusinessRentalItem(itemId, body);
      enqueueSnackbar(t('business.rentals.itemSaved', 'Rental item saved'), {
        variant: 'success',
      });
      await reload();
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ??
        t('business.rentals.saveFailed', 'Save failed');
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setSavingItem(false);
    }
  }, [
    cat,
    currency,
    desc,
    enqueueSnackbar,
    itemActive,
    itemId,
    name,
    reload,
    tags,
    t,
    updateBusinessRentalItem,
  ]);

  const saveListing = useCallback(
    async (listingId: string) => {
      const f = listingForms[listingId];
      if (!f) return;
      const body = buildListingUpdateBody(f);
      if (!body) {
        enqueueSnackbar(
          t('business.rentals.listingInvalid', 'Check listing numbers and max ≥ min.'),
          { variant: 'warning' }
        );
        return;
      }
      setSavingListingId(listingId);
      try {
        await updateBusinessRentalListing(listingId, body);
        enqueueSnackbar(t('business.rentals.listingSaved', 'Listing saved'), {
          variant: 'success',
        });
        await reload();
      } catch (error: any) {
        const msg =
          error?.response?.data?.message ??
          t('business.rentals.saveFailed', 'Save failed');
        enqueueSnackbar(msg, { variant: 'error' });
      } finally {
        setSavingListingId(null);
      }
    },
    [enqueueSnackbar, listingForms, reload, t, updateBusinessRentalListing]
  );

  if (!businessId) {
    return (
      <Typography sx={{ p: 3 }}>
        {t('business.dashboard.noBusinessProfile')}
      </Typography>
    );
  }

  if (loading) {
    return <LoadingPage message={t('common.loading', 'Loading...')} showProgress />;
  }

  if (!item) {
    return (
      <Box sx={{ p: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/business/rentals')}
          sx={{ mb: 2 }}
        >
          {t('business.rentals.backToCatalog', 'Back to rentals')}
        </Button>
        <Typography>{t('business.rentals.loadError', 'Could not load this rental.')}</Typography>
      </Box>
    );
  }

  return (
    <>
      <SEOHead title={t('business.rentals.editItemTitle', 'Edit rental')} />
      <Box sx={{ p: 2, maxWidth: 720, mx: 'auto' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/business/rentals')}
          >
            {t('business.rentals.backToCatalog', 'Back to rentals')}
          </Button>
          <Button component={RouterLink} to="/business/rental-images" variant="text">
            {t('business.rentals.manageImages', 'Manage images')}
          </Button>
        </Stack>

        <Typography variant="h4" gutterBottom>
          {t('business.rentals.editItemTitle', 'Edit rental')}
        </Typography>

        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t('business.rentals.editItemSection', 'Rental details')}
          </Typography>
          <Stack spacing={2}>
            <TextField
              label={t('common.name', 'Name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('common.description', 'Description')}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>{t('rentals.category', 'Category')}</InputLabel>
              <Select
                value={cat}
                label={t('rentals.category', 'Category')}
                onChange={(e) => setCat(e.target.value)}
              >
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('business.rentals.tagsHint', 'Tags (comma-separated)')}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('business.rentals.currency', 'Currency')}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={itemActive}
                  onChange={(_, v) => setItemActive(v)}
                />
              }
              label={t('business.rentals.itemActive', 'Active in catalog')}
            />
            <Button
              variant="contained"
              onClick={() => void saveItem()}
              disabled={savingItem}
            >
              {savingItem
                ? t('business.rentals.saving', 'Saving...')
                : t('common.save', 'Save')}
            </Button>
          </Stack>
        </Paper>

        <Typography variant="h6" gutterBottom>
          {t('business.rentals.listingsSection', 'Location listings')}
        </Typography>

        {item.rental_location_listings.map((l: BusinessRentalListingDetail) => {
          const f = listingForms[l.id];
          if (!f) return null;
          const locName = l.business_location?.name ?? l.business_location_id;
          return (
            <Paper key={l.id} sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                {t('business.rentals.listingAtLocation', {
                  defaultValue: 'Listing: {{location}}',
                  location: locName,
                })}
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label={t('business.rentals.pricePerDay', 'Price per day')}
                  value={f.base_price_per_day}
                  onChange={(e) =>
                    patchListingForm(l.id, { base_price_per_day: e.target.value })
                  }
                  type="number"
                  fullWidth
                />
                <TextField
                  label={t('rentals.minDays', 'Min days')}
                  value={f.min_rental_days}
                  onChange={(e) =>
                    patchListingForm(l.id, { min_rental_days: e.target.value })
                  }
                  type="number"
                  fullWidth
                />
                <TextField
                  label={t('rentals.maxDays', 'Max days')}
                  value={f.max_rental_days}
                  onChange={(e) =>
                    patchListingForm(l.id, { max_rental_days: e.target.value })
                  }
                  type="number"
                  helperText={t(
                    'business.rentals.maxDaysHint',
                    'Leave empty for no maximum'
                  )}
                  fullWidth
                />
                <TextField
                  label={t('business.rentals.units', 'Units available')}
                  value={f.units_available}
                  onChange={(e) =>
                    patchListingForm(l.id, { units_available: e.target.value })
                  }
                  type="number"
                  fullWidth
                />
                <TextField
                  label={t('rentals.pickupInstructions', 'Pickup instructions')}
                  value={f.pickup_instructions}
                  onChange={(e) =>
                    patchListingForm(l.id, { pickup_instructions: e.target.value })
                  }
                  multiline
                  minRows={2}
                  fullWidth
                />
                <TextField
                  label={t('rentals.dropoffInstructions', 'Dropoff instructions')}
                  value={f.dropoff_instructions}
                  onChange={(e) =>
                    patchListingForm(l.id, { dropoff_instructions: e.target.value })
                  }
                  multiline
                  minRows={2}
                  fullWidth
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={f.is_active}
                      onChange={(_, v) => patchListingForm(l.id, { is_active: v })}
                    />
                  }
                  label={t('business.rentals.listingActive', 'Listing active')}
                />
                <Button
                  variant="outlined"
                  onClick={() => void saveListing(l.id)}
                  disabled={savingListingId === l.id}
                >
                  {savingListingId === l.id
                    ? t('business.rentals.saving', 'Saving...')
                    : t('business.rentals.saveListing', 'Save listing')}
                </Button>
              </Stack>
            </Paper>
          );
        })}
      </Box>
    </>
  );
};

export default BusinessRentalItemEditPage;
