import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';
import {
  useRentalApi,
  RentalPricingSnapshotBody,
  type BusinessRentalItemRow,
  type BusinessRentalRequestRow,
} from '../../hooks/useRentalApi';
import { useRentalCategories } from '../../hooks/useRentalCategories';
import LoadingPage from '../common/LoadingPage';
import SEOHead from '../seo/SEOHead';

function rentalDays(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.ceil((e - s) / 86400000));
}

const BusinessRentalsPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const businessId = profile?.business?.id;
  const { categories } = useRentalCategories();
  const { locations } = useBusinessLocations(businessId);
  const {
    respondRequest,
    fetchBusinessRentalItems,
    fetchBusinessRentalRequests,
    createBusinessRentalItem,
    createBusinessRentalListing,
  } = useRentalApi();
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState<BusinessRentalItemRow[]>([]);
  const [requests, setRequests] = useState<BusinessRentalRequestRow[]>([]);
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
  const [minD, setMinD] = useState('1');
  const [maxD, setMaxD] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [units, setUnits] = useState('1');
  const [note, setNote] = useState('');

  const loadItems = useCallback(async () => {
    const list = await fetchBusinessRentalItems();
    setItems(list);
  }, [fetchBusinessRentalItems]);

  const loadRequests = useCallback(async () => {
    const list = await fetchBusinessRentalRequests();
    setRequests(list);
  }, [fetchBusinessRentalRequests]);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([loadItems(), loadRequests()])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [businessId, loadItems, loadRequests]);

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
    await createBusinessRentalListing({
      rental_item_id: selItem,
      business_location_id: selLoc,
      pickup_instructions: pickup,
      dropoff_instructions: dropoff,
      base_price_per_day: Number(price),
      min_rental_days: Number(minD) || 1,
      max_rental_days: maxD ? Number(maxD) : null,
      units_available: Number(units) || 1,
    });
    setListOpen(false);
    void loadItems();
  };

  const respond = async (req: BusinessRentalRequestRow, available: boolean) => {
    if (!available) {
      await respondRequest(req.id, { status: 'unavailable', businessResponseNote: note });
    } else {
      const days = rentalDays(req.requested_start_at, req.requested_end_at);
      const rate = Number(req.rental_location_listing.base_price_per_day);
      const total = days * rate;
      const cur = req.rental_location_listing.rental_item.currency;
      const snap: RentalPricingSnapshotBody = {
        version: 1,
        currency: cur,
        total,
        ratePerDay: rate,
        days,
        computedAt: new Date().toISOString(),
      };
      await respondRequest(req.id, {
        status: 'available',
        rentalPricingSnapshot: snap,
        businessResponseNote: note,
      });
    }
    setNote('');
    void loadRequests();
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
      <SEOHead title={t('business.rentals.pageTitle', 'Rentals')} />
      <Box sx={{ p: 2 }}>
        <Typography variant="h4" gutterBottom>
          {t('business.rentals.pageTitle', 'Rentals')}
        </Typography>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label={t('business.rentals.catalogTab', 'Catalog')} />
          <Tab label={t('business.rentals.requestsTab', 'Requests')} />
        </Tabs>
        {tab === 0 && (
          <Box>
            <Button variant="contained" sx={{ mr: 1 }} onClick={() => setItemOpen(true)}>
              {t('business.rentals.addItem', 'Add rental item')}
            </Button>
            <Button variant="outlined" onClick={() => setListOpen(true)}>
              {t('business.rentals.addListing', 'Add location listing')}
            </Button>
            {items.map((it) => (
              <Box key={it.id} sx={{ border: 1, borderColor: 'divider', p: 2, mt: 2 }}>
                <Typography variant="h6">{it.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {it.description}
                </Typography>
                <Typography variant="caption">
                  {t('business.rentals.listingsCount', 'Listings')}:{' '}
                  {it.rental_location_listings?.length ?? 0}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        {tab === 1 && (
          <Box>
            {requests.map((req) => (
              <Box key={req.id} sx={{ border: 1, borderColor: 'divider', p: 2, mb: 2 }}>
                <Typography variant="subtitle1">
                  {req.rental_location_listing?.rental_item?.name}
                </Typography>
                <Typography variant="body2">
                  {req.requested_start_at} → {req.requested_end_at}
                </Typography>
                <Typography>Status: {req.status}</Typography>
                {req.status === 'pending' && (
                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={() => void respond(req, true)}>
                      {t('business.rentals.markAvailable', 'Available')}
                    </Button>
                    <Button size="small" color="warning" onClick={() => void respond(req, false)}>
                      {t('business.rentals.markUnavailable', 'Unavailable')}
                    </Button>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}
        {tab === 1 && (
          <TextField
            fullWidth
            sx={{ mt: 2 }}
            label={t('business.rentals.responseNote', 'Response note (optional)')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </Box>

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
          <FormControl fullWidth>
            <InputLabel>{t('business.rentals.item', 'Rental item')}</InputLabel>
            <Select
              value={selItem}
              label={t('business.rentals.item', 'Rental item')}
              onChange={(e) => setSelItem(e.target.value as string)}
            >
              {items.map((it) => (
                <MenuItem key={it.id} value={it.id}>
                  {it.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
            label={t('business.rentals.pricePerDay', 'Price per day')}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
          />
          <TextField label={t('rentals.minDays', 'Min days')} value={minD} onChange={(e) => setMinD(e.target.value)} />
          <TextField label={t('rentals.maxDays', 'Max days')} value={maxD} onChange={(e) => setMaxD(e.target.value)} />
          <TextField label={t('business.rentals.units', 'Units available')} value={units} onChange={(e) => setUnits(e.target.value)} />
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

export default BusinessRentalsPage;
