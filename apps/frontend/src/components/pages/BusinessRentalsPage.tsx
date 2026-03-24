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
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Storefront } from '@mui/icons-material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';
import {
  useRentalApi,
  type BusinessRentalItemRow,
  type BusinessRentalRequestRow,
  type BusinessRentalScheduleRow,
} from '../../hooks/useRentalApi';
import { useRentalCategories } from '../../hooks/useRentalCategories';
import { BusinessRentalRespondDialog } from '../rentals/BusinessRentalRespondDialog';
import { BusinessRentalRequestCard } from '../rentals/BusinessRentalRequestCard';
import LoadingPage from '../common/LoadingPage';
import SEOHead from '../seo/SEOHead';

type WeeklyAvailabilitySlot = {
  weekday: number;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
};

function dateKeyFromIso(iso?: string | null): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateTimeNoTimezone(iso?: string | null): string {
  if (!iso) {
    return '-';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const BusinessRentalsPage: React.FC = () => {
  const defaultWeeklyAvailability: WeeklyAvailabilitySlot[] = [
    { weekday: 0, is_available: false, start_time: null, end_time: null },
    { weekday: 1, is_available: true, start_time: '08:00:00', end_time: '20:00:00' },
    { weekday: 2, is_available: true, start_time: '08:00:00', end_time: '20:00:00' },
    { weekday: 3, is_available: true, start_time: '08:00:00', end_time: '20:00:00' },
    { weekday: 4, is_available: true, start_time: '08:00:00', end_time: '20:00:00' },
    { weekday: 5, is_available: true, start_time: '08:00:00', end_time: '20:00:00' },
    { weekday: 6, is_available: true, start_time: '08:00:00', end_time: '20:00:00' },
  ];
  const weekdayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const businessId = profile?.business?.id;
  const { categories } = useRentalCategories();
  const { locations } = useBusinessLocations(businessId);
  const {
    respondRequest,
    fetchBusinessRentalItems,
    fetchBusinessRentalRequests,
    fetchBusinessRentalSchedule,
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
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailabilitySlot[]>(defaultWeeklyAvailability);
  const [respondTarget, setRespondTarget] = useState<{
    req: BusinessRentalRequestRow;
    mode: 'available' | 'unavailable';
  } | null>(null);
  const [scheduleItemId, setScheduleItemId] = useState('');
  const [scheduleRows, setScheduleRows] = useState<BusinessRentalScheduleRow[]>(
    []
  );
  const [selectedScheduleDay, setSelectedScheduleDay] = useState('');
  const sortedRequests = useMemo(
    () =>
      [...requests].sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
      }),
    [requests]
  );
  const scheduleEvents = useMemo(() => {
    const dayCounts = new Map<string, number>();
    scheduleRows.forEach((row) => {
      const key = dateKeyFromIso(row.start_at);
      if (!key) {
        return;
      }
      dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    });
    return Array.from(dayCounts.entries()).map(([dayKey, count]) => ({
      id: dayKey,
      start: dayKey,
      allDay: true,
      title: t('business.rentals.scheduleCount', '{{count}} rental(s)', { count }),
    }));
  }, [scheduleRows, t]);
  const scheduleRowsForSelectedDay = useMemo(
    () =>
      scheduleRows.filter(
        (row) =>
          selectedScheduleDay &&
          dateKeyFromIso(row.start_at) === selectedScheduleDay
      ),
    [scheduleRows, selectedScheduleDay]
  );

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
      .catch((error: unknown) => {
        console.error('Failed to load business rentals data', error);
      })
      .finally(() => setLoading(false));
  }, [businessId, loadItems, loadRequests]);

  useEffect(() => {
    if (!scheduleItemId && items.length > 0) {
      setScheduleItemId(items[0].id);
    }
  }, [items, scheduleItemId]);

  useEffect(() => {
    if (!scheduleItemId) {
      setScheduleRows([]);
      return;
    }
    fetchBusinessRentalSchedule(scheduleItemId)
      .then((rows) => {
        setScheduleRows(rows);
        const firstDay = dateKeyFromIso(rows[0]?.start_at);
        setSelectedScheduleDay(firstDay || '');
      })
      .catch((error: unknown) => {
        console.error('Failed to load rental schedule', error);
        setScheduleRows([]);
      });
  }, [fetchBusinessRentalSchedule, scheduleItemId]);

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
      base_price_per_hour: Number(price),
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
      <SEOHead title={t('business.rentals.pageTitle', 'Rentals')} />
      <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 3,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            mb: 2,
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                  }}
                >
                  <Storefront fontSize="small" />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {t('business.rentals.pageTitle', 'Rentals')}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t('business.rentals.pageSubtitle', 'Manage rental items, listings, and booking requests in one place.')}
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => navigate('/dashboard')}>
              {t('business.rentals.backToDashboard', 'Back to dashboard')}
            </Button>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 3, border: 1, borderColor: 'divider', p: { xs: 1, md: 2 } }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label={t('business.rentals.catalogTab', 'Catalog')} />
            <Tab label={t('business.rentals.requestsTab', 'Requests')} />
            <Tab label={t('business.rentals.myScheduleTab', 'MySchedule')} />
          </Tabs>
        {tab === 0 && (
          <Box sx={{ px: { xs: 1, md: 0.5 }, pb: { xs: 1, md: 0.5 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
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
                  mt: 2,
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  textAlign: 'center',
                  bgcolor: 'background.default',
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {t('business.rentals.emptyCatalogTitle', 'No rental items yet')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {t('business.rentals.emptyCatalogBody', 'Start by adding your first rental item, then create a listing for a location.')}
                </Typography>
              </Paper>
            )}
            {items.map((it) => {
              const thumb = it.rental_item_images?.[0]?.image_url;
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
                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                      <Chip size="small" label={`${t('business.rentals.listingsCount', 'Listings')}: ${it.rental_location_listings?.length ?? 0}`} />
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
          </Box>
        )}
        {tab === 1 && (
          <Box sx={{ px: { xs: 1, md: 0.5 }, pb: { xs: 1, md: 0.5 } }}>
            {requests.length === 0 && (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  textAlign: 'center',
                  bgcolor: 'background.default',
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {t('business.rentals.emptyRequestsTitle', 'No booking requests')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {t('business.rentals.emptyRequestsBody', 'Incoming rental requests will appear here when clients submit them.')}
                </Typography>
              </Paper>
            )}
            {sortedRequests.map((req) => (
              <BusinessRentalRequestCard
                key={req.id}
                request={req}
                onAccept={(selected) => setRespondTarget({ req: selected, mode: 'available' })}
                onReject={(selected) => setRespondTarget({ req: selected, mode: 'unavailable' })}
              />
            ))}
          </Box>
        )}
        {tab === 2 && (
          <Box sx={{ px: { xs: 1, md: 0.5 }, pb: { xs: 1, md: 0.5 } }}>
            <Autocomplete
              fullWidth
              sx={{ mb: 2 }}
              options={items}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              value={items.find((it) => it.id === scheduleItemId) ?? null}
              onChange={(_, option) => setScheduleItemId(option?.id ?? '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t(
                    'business.rentals.scheduleItemSelect',
                    'Select rental item'
                  )}
                />
              )}
            />
            {!scheduleItemId ? (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  textAlign: 'center',
                  bgcolor: 'background.default',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {t(
                    'business.rentals.scheduleSelectPrompt',
                    'Select a rental item to view its schedule.'
                  )}
                </Typography>
              </Paper>
            ) : (
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems="stretch"
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'divider',
                    flex: { xs: '1 1 auto', md: '0 0 58%' },
                    minWidth: 0,
                  }}
                >
                  <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    height="auto"
                    events={scheduleEvents}
                    eventDisplay="block"
                    dateClick={(info: { dateStr: string }) =>
                      setSelectedScheduleDay(info.dateStr)
                    }
                  />
                </Paper>

                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'divider',
                    flex: { xs: '1 1 auto', md: '1 1 42%' },
                    minWidth: 0,
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {t('business.rentals.scheduleDetailsTitle', 'Day details')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {selectedScheduleDay || t('business.rentals.scheduleNoDay', 'No day selected')}
                  </Typography>
                  {scheduleRowsForSelectedDay.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      {t(
                        'business.rentals.scheduleNoRentalsForDay',
                        'No rentals found for this day.'
                      )}
                    </Typography>
                  ) : (
                    scheduleRowsForSelectedDay.map((row) => {
                      const clientUser = row.rental_request?.client?.user;
                      const clientName = `${clientUser?.first_name || ''} ${clientUser?.last_name || ''}`.trim();
                      return (
                        <Box
                          key={row.id}
                          sx={{
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1.5,
                            p: 1.5,
                            mb: 1.25,
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {formatDateTimeNoTimezone(row.start_at)} {'->'}{' '}
                            {formatDateTimeNoTimezone(row.end_at)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                            {t('common.status', 'Status')}: {row.status}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {t('business.rentals.location', 'Location')}:{' '}
                            {row.rental_location_listing?.business_location?.name || '-'}
                          </Typography>
                          {clientName ? (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {t('business.rentals.client', 'Client')}: {clientName}
                            </Typography>
                          ) : null}
                          {clientUser?.phone_number ? (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {t('common.phone', 'Phone')}: {clientUser.phone_number}
                            </Typography>
                          ) : null}
                        </Box>
                      );
                    })
                  )}
                </Paper>
              </Stack>
            )}
          </Box>
        )}
        </Paper>
      </Box>

      <BusinessRentalRespondDialog
        open={!!respondTarget}
        mode={respondTarget?.mode ?? null}
        request={respondTarget?.req ?? null}
        onClose={() => setRespondTarget(null)}
        onSuccess={() => void loadRequests()}
        respondRequest={respondRequest}
      />

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
            value={items.find((it) => it.id === selItem) ?? null}
            onChange={(_, option) => setSelItem(option?.id ?? '')}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('business.rentals.item', 'Rental item')}
              />
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
          <TextField label={t('rentals.minHours', 'Min hours')} value={minD} onChange={(e) => setMinD(e.target.value)} />
          <TextField label={t('rentals.maxHours', 'Max hours')} value={maxD} onChange={(e) => setMaxD(e.target.value)} />
          <TextField label={t('business.rentals.units', 'Units available')} value={units} onChange={(e) => setUnits(e.target.value)} />
          <Typography variant="subtitle2">
            {t('business.rentals.weeklyAvailability', 'Weekly availability')}
          </Typography>
          {weeklyAvailability.map((slot, index) => (
            <Box key={slot.weekday} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
              <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                {weekdayLabels[slot.weekday]}
              </Typography>
              <TextField
                label={t('rentals.start', 'Start')}
                type="time"
                value={(slot.start_time ?? '08:00:00').slice(0, 5)}
                disabled={!slot.is_available}
                onChange={(e) =>
                  setWeeklyAvailability((prev: WeeklyAvailabilitySlot[]) =>
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
                  setWeeklyAvailability((prev: WeeklyAvailabilitySlot[]) =>
                    prev.map((s, i) => (i === index ? { ...s, end_time: `${e.target.value}:00` } : s))
                  )
                }
              />
              <Button
                size="small"
                onClick={() =>
                  setWeeklyAvailability((prev: WeeklyAvailabilitySlot[]) =>
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

export default BusinessRentalsPage;
