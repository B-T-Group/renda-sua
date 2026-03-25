import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';
import {
  useRentalApi,
  type BusinessRentalItemRow,
} from '../../hooks/useRentalApi';
import { useRentalCategories } from '../../hooks/useRentalCategories';
import BusinessRentalsStudioShell from '../rentals/BusinessRentalsStudioShell';
import {
  createDefaultWeeklyAvailability,
  WEEKDAY_LABELS,
  type WeeklyAvailabilitySlot,
} from '../rentals/businessRentalsShared';
import RentalListingModerationStatusChip from '../rentals/RentalListingModerationStatusChip';
import LoadingPage from '../common/LoadingPage';

const BusinessRentalsCatalogPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const businessId = profile?.business?.id;
  const { categories } = useRentalCategories();
  const { locations } = useBusinessLocations(businessId);
  const { fetchBusinessRentalItems, createBusinessRentalItem, createBusinessRentalListing } =
    useRentalApi();

  const [items, setItems] = useState<BusinessRentalItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemOpen, setItemOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('');
  const [tags, setTags] = useState('');
  const [selItem, setSelItem] = useState('');
  const [selLoc, setSelLoc] = useState('');
  const [price, setPrice] = useState('');
  const [priceDay, setPriceDay] = useState('');
  const [minD, setMinD] = useState('1');
  const [maxD, setMaxD] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [units, setUnits] = useState('1');
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailabilitySlot[]>(() =>
    createDefaultWeeklyAvailability()
  );

  const loadItems = useCallback(async () => {
    const list = await fetchBusinessRentalItems();
    setItems(list);
  }, [fetchBusinessRentalItems]);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadItems()
      .catch((error: unknown) => {
        console.error('Failed to load rental catalog', error);
      })
      .finally(() => setLoading(false));
  }, [businessId, loadItems]);

  const saveItem = async () => {
    if (!businessId || !cat) return;
    await createBusinessRentalItem({
      rental_category_id: cat,
      name,
      description: desc,
      tags: tags
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      currency: 'XAF',
    });
    setItemOpen(false);
    void loadItems();
  };

  const saveListing = async () => {
    if (!selItem || !selLoc) return;
    const hourly = Number(price);
    const daily =
      priceDay.trim() === '' ? Number((hourly * 12).toFixed(2)) : Number(priceDay);
    await createBusinessRentalListing({
      rental_item_id: selItem,
      business_location_id: selLoc,
      pickup_instructions: pickup,
      dropoff_instructions: dropoff,
      base_price_per_hour: hourly,
      base_price_per_day: daily,
      min_rental_hours: Number(minD) || 1,
      max_rental_hours: maxD ? Number(maxD) : null,
      units_available: Number(units) || 1,
      weekly_availability: weeklyAvailability,
    });
    setListOpen(false);
    void loadItems();
  };

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

  return (
    <>
      <BusinessRentalsStudioShell
        seoTitle={t('business.rentals.catalogPageTitle', 'Rental catalog')}
        pageTitle={t('business.rentals.catalogPageTitle', 'Rental catalog')}
        pageSubtitle={t(
          'business.rentals.catalogPageSubtitle',
          'Create rental items and publish listings at your locations.'
        )}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
          <Button variant="contained" onClick={() => setItemOpen(true)}>
            {t('business.rentals.addItem', 'Add rental item')}
          </Button>
          <Button variant="outlined" onClick={() => setListOpen(true)}>
            {t('business.rentals.addListing', 'Add location listing')}
          </Button>
        </Stack>
        {items.length === 0 && (
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              textAlign: 'center',
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('business.rentals.emptyCatalogTitle', 'No rental items yet')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {t(
                'business.rentals.emptyCatalogBody',
                'Start by adding your first rental item, then create a listing for a location.'
              )}
            </Typography>
          </Paper>
        )}
        {items.map((it) => {
          const thumb = it.rental_item_images?.[0]?.image_url;
          const pendingModeration =
            it.rental_location_listings?.filter(
              (l) => !l.deleted_at && l.moderation_status === 'pending'
            ).length ?? 0;
          return (
            <Box
              key={it.id}
              sx={{
                border: 1,
                borderColor: 'divider',
                p: 2,
                mt: 2,
                borderRadius: 2,
                display: 'flex',
                gap: 2,
                alignItems: 'flex-start',
                bgcolor: 'background.paper',
                transition: 'box-shadow 0.2s',
                '&:hover': { boxShadow: 1 },
                opacity: it.deleted_at ? 0.75 : 1,
              }}
            >
              {thumb ? (
                <Box
                  component="img"
                  src={thumb}
                  alt=""
                  sx={{
                    width: 88,
                    height: 88,
                    objectFit: 'cover',
                    borderRadius: 1,
                    flexShrink: 0,
                    bgcolor: 'action.hover',
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: 88,
                    height: 88,
                    flexShrink: 0,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: 0.5,
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {t('rentals.noImage', 'No image')}
                  </Typography>
                </Box>
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6">{it.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {it.description}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1, mt: 0.5 }} flexWrap="wrap">
                  <Chip
                    size="small"
                    label={`${t('business.rentals.listingsCount', 'Listings')}: ${it.rental_location_listings?.length ?? 0}`}
                  />
                  {pendingModeration > 0 ? (
                    <Chip
                      size="small"
                      color="warning"
                      variant="outlined"
                      label={t('business.rentals.moderation.pendingListingsBadge', {
                        defaultValue: '{{count}} listing(s) pending approval',
                        count: pendingModeration,
                      })}
                    />
                  ) : null}
                  {it.deleted_at ? (
                    <Chip
                      size="small"
                      color="default"
                      variant="outlined"
                      label={t(
                        'business.rentals.softDelete.catalogBadge',
                        'Removed from catalog'
                      )}
                    />
                  ) : null}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => navigate(`/business/rentals/items/${it.id}`)}
                  >
                    {t('business.rentals.preview', 'Preview')}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/business/rentals/items/${it.id}/edit`)}
                  >
                    {t('business.rentals.edit', 'Edit')}
                  </Button>
                </Stack>
              </Box>
            </Box>
          );
        })}
      </BusinessRentalsStudioShell>

      <Dialog open={itemOpen} onClose={() => setItemOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('business.rentals.addItem', 'Add rental item')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label={t('common.name', 'Name')} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField
            label={t('common.description', 'Description')}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            multiline
            minRows={2}
          />
          <FormControl fullWidth>
            <InputLabel>{t('rentals.category', 'Category')}</InputLabel>
            <Select
              value={cat}
              label={t('rentals.category', 'Category')}
              onChange={(e) => setCat(e.target.value as string)}
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
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
          <Button variant="contained" onClick={() => void saveItem()}>
            {t('common.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={listOpen} onClose={() => setListOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('business.rentals.addListing', 'Add location listing')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Autocomplete
            fullWidth
            sx={{ mt: 2 }}
            options={items}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            value={items.find((item) => item.id === selItem) ?? null}
            onChange={(_, option) => setSelItem(option?.id ?? '')}
            renderInput={(params) => (
              <TextField {...params} label={t('business.rentals.item', 'Rental item')} />
            )}
          />
          <FormControl fullWidth>
            <InputLabel>{t('common.locations', 'Location')}</InputLabel>
            <Select
              value={selLoc}
              label={t('common.locations', 'Location')}
              onChange={(e) => setSelLoc(e.target.value as string)}
            >
              {locations.map((loc) => (
                <MenuItem key={loc.id} value={loc.id}>
                  {loc.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label={t('business.rentals.pricePerHour', 'Price per hour')}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
          />
          <TextField
            label={t('business.rentals.pricePerDay', 'Full day price (daily rate)')}
            value={priceDay}
            onChange={(e) => setPriceDay(e.target.value)}
            type="number"
            helperText={t(
              'business.rentals.pricePerDayHint',
              'Leave empty to use 12 × hourly rate'
            )}
          />
          <TextField label={t('rentals.minHours', 'Min hours')} value={minD} onChange={(e) => setMinD(e.target.value)} />
          <TextField label={t('rentals.maxHours', 'Max hours')} value={maxD} onChange={(e) => setMaxD(e.target.value)} />
          <TextField
            label={t('business.rentals.units', 'Units available')}
            value={units}
            onChange={(e) => setUnits(e.target.value)}
          />
          <Typography variant="subtitle2">
            {t('business.rentals.weeklyAvailability', 'Weekly availability')}
          </Typography>
          {weeklyAvailability.map((slot, index) => (
            <Box key={slot.weekday} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
              <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                {WEEKDAY_LABELS[slot.weekday]}
              </Typography>
              <TextField
                label={t('rentals.start', 'Start')}
                type="time"
                value={(slot.start_time ?? '08:00:00').slice(0, 5)}
                disabled={!slot.is_available}
                onChange={(e) =>
                  setWeeklyAvailability((prev) =>
                    prev.map((s, i) => (i === index ? { ...s, start_time: `${e.target.value}:00` } : s))
                  )
                }
              />
              <TextField
                label={t('rentals.end', 'End')}
                type="time"
                value={(slot.end_time ?? '20:00:00').slice(0, 5)}
                disabled={!slot.is_available}
                onChange={(e) =>
                  setWeeklyAvailability((prev) =>
                    prev.map((s, i) => (i === index ? { ...s, end_time: `${e.target.value}:00` } : s))
                  )
                }
              />
              <Button
                size="small"
                onClick={() =>
                  setWeeklyAvailability((prev) =>
                    prev.map((s, i) =>
                      i === index
                        ? {
                            ...s,
                            is_available: !s.is_available,
                            start_time: !s.is_available ? '08:00:00' : null,
                            end_time: !s.is_available ? '20:00:00' : null,
                          }
                        : s
                    )
                  )
                }
              >
                {slot.is_available ? t('common.disable', 'Disable') : t('common.enable', 'Enable')}
              </Button>
            </Box>
          ))}
          <TextField
            label={t('rentals.pickupInstructions', 'Pickup instructions')}
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
            multiline
          />
          <TextField
            label={t('rentals.dropoffInstructions', 'Dropoff instructions')}
            value={dropoff}
            onChange={(e) => setDropoff(e.target.value)}
            multiline
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setListOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
          <Button variant="contained" onClick={() => void saveListing()}>
            {t('common.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BusinessRentalsCatalogPage;
