import {
  Autocomplete,
  Box,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateClickArg, EventClickArg } from '@fullcalendar/interaction';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  useRentalApi,
  type BusinessRentalItemRow,
  type BusinessRentalScheduleRow,
} from '../../hooks/useRentalApi';
import { dateKeyFromIso, formatDateTimeNoTimezone } from '../../utils/businessRentalsFormat';
import BusinessRentalsStudioShell from '../rentals/BusinessRentalsStudioShell';
import LoadingPage from '../common/LoadingPage';

const BusinessRentalsSchedulePage: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const businessId = profile?.business?.id;
  const { fetchBusinessRentalItems, fetchBusinessRentalSchedule } = useRentalApi();
  const [items, setItems] = useState<BusinessRentalItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleItemId, setScheduleItemId] = useState('');
  const [scheduleRows, setScheduleRows] = useState<BusinessRentalScheduleRow[]>([]);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState('');

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
        console.error('Failed to load rental items for schedule', error);
      })
      .finally(() => setLoading(false));
  }, [businessId, loadItems]);

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
          selectedScheduleDay && dateKeyFromIso(row.start_at) === selectedScheduleDay
      ),
    [scheduleRows, selectedScheduleDay]
  );

  const handleCalendarDateClick = useCallback((info: DateClickArg) => {
    setSelectedScheduleDay(info.dateStr);
  }, []);

  const handleCalendarEventClick = useCallback((info: EventClickArg) => {
    const dayKey = dateKeyFromIso(info.event.startStr);
    if (dayKey) {
      setSelectedScheduleDay(dayKey);
    }
  }, []);

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
    <BusinessRentalsStudioShell
      seoTitle={t('business.rentals.schedulePageTitle', 'Rental schedule')}
      pageTitle={t('business.rentals.schedulePageTitle', 'Rental schedule')}
      pageSubtitle={t(
        'business.rentals.schedulePageSubtitle',
        'See confirmed rentals on the calendar and inspect each day.'
      )}
    >
      {items.length === 0 ? (
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
              'business.rentals.scheduleNeedItemsHint',
              'Add a rental item in the catalog before you can view a schedule.'
            )}
          </Typography>
        </Paper>
      ) : (
        <>
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
            label={t('business.rentals.scheduleItemSelect', 'Select rental item')}
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
            bgcolor: 'action.hover',
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
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              flex: { xs: '1 1 auto', md: '0 0 58%' },
              minWidth: 0,
              '& .fc-daygrid-day.fc-day-selected': {
                backgroundColor: 'action.selected',
              },
              '& .fc-daygrid-day-number': {
                cursor: 'pointer',
              },
              '& .fc-daygrid-event': {
                cursor: 'pointer',
              },
            }}
          >
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              height="auto"
              events={scheduleEvents}
              eventDisplay="block"
              dateClick={handleCalendarDateClick}
              eventClick={handleCalendarEventClick}
              dayCellClassNames={(arg) =>
                arg.dateStr === selectedScheduleDay ? ['fc-day-selected'] : []
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
        </>
      )}
    </BusinessRentalsStudioShell>
  );
};

export default BusinessRentalsSchedulePage;
