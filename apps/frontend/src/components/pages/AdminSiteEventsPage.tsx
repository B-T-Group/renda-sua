import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { endOfDay, startOfDay, subDays } from 'date-fns';
import { enUS, fr as frDfn } from 'date-fns/locale';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  type AdminSiteEventRow,
  type AdminSiteEventSummary,
  useAdminSiteEventsApi,
} from '../../hooks/useAdminSiteEvents';
import SiteEventSummaryChart from '../admin/SiteEventSummaryChart';
import LoadingScreen from '../common/LoadingScreen';
import SEOHead from '../seo/SEOHead';

type FilterForm = {
  eventType: string;
  subjectType: string;
  subjectId: string;
  from: Date | null;
  to: Date | null;
};

function defaultDateRange() {
  const to = endOfDay(new Date());
  const from = startOfDay(subDays(to, 6));
  return { from, to };
}

const emptyTextFields = { eventType: '', subjectType: '', subjectId: '' };

const initialRange = defaultDateRange();

const emptyFilters: FilterForm = {
  ...emptyTextFields,
  from: initialRange.from,
  to: initialRange.to,
};

function toFromIso(d: Date | null): string | undefined {
  if (!d) {
    return undefined;
  }
  return startOfDay(d).toISOString();
}

function toToIso(d: Date | null): string | undefined {
  if (!d) {
    return undefined;
  }
  return endOfDay(d).toISOString();
}

function filtersToQuery(f: FilterForm) {
  return {
    eventType: f.eventType || undefined,
    subjectType: f.subjectType || undefined,
    subjectId: f.subjectId || undefined,
    from: toFromIso(f.from),
    to: toToIso(f.to),
  };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max - 1)}…`;
}

function formatSubject(row: AdminSiteEventRow): string {
  if (!row.subject_type && !row.subject_id) {
    return '—';
  }
  return `${row.subject_type ?? ''} ${row.subject_id ?? ''}`.trim();
}

function formatViewer(row: AdminSiteEventRow): string {
  return `${row.viewer_type}: ${truncate(row.viewer_id, 48)}`;
}

const AdminSiteEventsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile, loading: profileLoading, error: profileError } =
    useUserProfileContext();
  const { fetchList, fetchSummary, exportCsv, listLoading, exportLoading, error } =
    useAdminSiteEventsApi();

  const [draft, setDraft] = useState<FilterForm>(() => ({ ...emptyFilters }));
  const [applied, setApplied] = useState<FilterForm>(() => ({ ...emptyFilters }));
  const [items, setItems] = useState<AdminSiteEventRow[]>([]);
  const [summary, setSummary] = useState<AdminSiteEventSummary>({
    total: 0,
    byEventType: [],
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const load = useCallback(async () => {
    const q = filtersToQuery(applied);
    const [data, sum] = await Promise.all([
      fetchList({
        limit: rowsPerPage,
        offset: page * rowsPerPage,
        ...q,
      }),
      fetchSummary(q),
    ]);
    setItems(data.items);
    setTotal(data.total);
    setSummary(sum);
  }, [fetchList, fetchSummary, page, rowsPerPage, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const onApply = () => {
    setApplied({ ...draft });
    setPage(0);
  };

  const onExport = async () => {
    try {
      await exportCsv(filtersToQuery(applied));
      enqueueSnackbar(
        t('admin.siteEvents.exportStarted', 'Download started'),
        { variant: 'success' }
      );
    } catch {
      enqueueSnackbar(
        t('admin.siteEvents.exportFailed', 'Export failed'),
        { variant: 'error' }
      );
    }
  };

  const eventTypeLabel = (raw: string) => {
    if (raw === 'other') {
      return t('admin.siteEvents.summary.otherBucket', 'Other event types');
    }
    return raw;
  };

  if (profileLoading) {
    return <LoadingScreen />;
  }

  if (profileError) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography color="error">
          {t('common.error', 'Error')}: {profileError}
        </Typography>
      </Container>
    );
  }

  if (!profile?.business) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography color="error">
          {t(
            'admin.siteEvents.noBusinessProfile',
            'Business profile not found'
          )}
        </Typography>
      </Container>
    );
  }

  if (!profile.business.is_admin) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography color="error">
          {t(
            'admin.siteEvents.unauthorized',
            'You are not authorized to access this page'
          )}
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t('admin.siteEvents.pageTitle', 'Site events')}
        description={t(
          'admin.siteEvents.pageDescription',
          'Browse client-side analytics events and export CSV.'
        )}
        keywords={t(
          'admin.siteEvents.pageKeywords',
          'admin, analytics, site events, export'
        )}
      />

      <Typography variant="h4" component="h1" gutterBottom>
        {t('admin.siteEvents.pageTitle', 'Site events')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'admin.siteEvents.pageDescription',
          'See aggregated event counts to understand what people are doing, then browse raw events or export CSV. Default view is the last 7 full days; adjust the date range as needed.'
        )}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={1} sx={{ mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {t('admin.siteEvents.summary.title', 'Activity summary')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'admin.siteEvents.summary.caption',
              'Counts in the current date range and filters. Rows are ordered by count.'
            )}
          </Typography>
        </Stack>
        {listLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={2}
            alignItems="flex-start"
          >
            {summary.total > 0 ? (
              <Box sx={{ width: { xs: '100%', lg: '50%' } }}>
                <SiteEventSummaryChart
                  summary={summary}
                  eventTypeLabel={eventTypeLabel}
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ textAlign: 'center' }}>
                  {t(
                    'admin.siteEvents.chart.caption',
                    'Donut: share of each type. Bar: exact counts.'
                  )}
                </Typography>
              </Box>
            ) : null}
            <TableContainer
              sx={{ width: { xs: '100%', lg: summary.total > 0 ? '50%' : '100%' } }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>
                      {t('admin.siteEvents.summary.colMetric', 'Metric')}
                    </TableCell>
                    <TableCell align="right">
                      {t('admin.siteEvents.summary.colCount', 'Count')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      {t('admin.siteEvents.summary.totalEvents', 'All events (filtered)')}
                    </TableCell>
                    <TableCell align="right">{summary.total}</TableCell>
                  </TableRow>
                  {summary.total === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2}>
                        {t('admin.siteEvents.summary.empty', 'No events in this range.')}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {summary.total > 0 && summary.byEventType.length === 0 && applied.eventType ? (
                    <TableRow>
                      <TableCell colSpan={2}>
                        <Typography variant="body2" color="text.secondary">
                          {t(
                            'admin.siteEvents.summary.breakdownHidden',
                            'Event type filter is set — the total above matches that type.'
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {summary.byEventType.map((row) => (
                    <TableRow key={row.eventType}>
                      <TableCell
                        title={row.eventType}
                        sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                      >
                        {eventTypeLabel(row.eventType)}
                      </TableCell>
                      <TableCell align="right">{row.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2} direction="row" flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            label={t('admin.siteEvents.eventType', 'Event type')}
            value={draft.eventType}
            onChange={(e) =>
              setDraft((d) => ({ ...d, eventType: e.target.value }))
            }
            sx={{ minWidth: 220 }}
          />
          <TextField
            size="small"
            label={t('admin.siteEvents.subjectType', 'Subject type')}
            value={draft.subjectType}
            onChange={(e) =>
              setDraft((d) => ({ ...d, subjectType: e.target.value }))
            }
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            label={t('admin.siteEvents.subjectId', 'Subject id')}
            value={draft.subjectId}
            onChange={(e) =>
              setDraft((d) => ({ ...d, subjectId: e.target.value }))
            }
            sx={{ minWidth: 260 }}
          />
          <LocalizationProvider
            dateAdapter={AdapterDateFns}
            adapterLocale={i18n.language === 'fr' ? frDfn : enUS}
          >
            <DatePicker
              label={t('admin.siteEvents.fromDate', 'From date')}
              value={draft.from}
              onChange={(v) => setDraft((d) => ({ ...d, from: v }))}
              slotProps={{ textField: { size: 'small' } }}
              sx={{ minWidth: 200 }}
            />
            <DatePicker
              label={t('admin.siteEvents.toDate', 'To date')}
              value={draft.to}
              onChange={(v) => setDraft((d) => ({ ...d, to: v }))}
              slotProps={{ textField: { size: 'small' } }}
              sx={{ minWidth: 200 }}
            />
          </LocalizationProvider>
          <Button variant="contained" onClick={() => onApply()}>
            {t('admin.siteEvents.applyFilters', 'Apply filters')}
          </Button>
          <Button
            variant="outlined"
            onClick={() => void onExport()}
            disabled={exportLoading}
            startIcon={
              exportLoading ? (
                <CircularProgress color="inherit" size={18} />
              ) : undefined
            }
          >
            {t('admin.siteEvents.exportCsv', 'Export CSV')}
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('admin.siteEvents.colTime', 'Time')}</TableCell>
              <TableCell>{t('admin.siteEvents.colEvent', 'Event')}</TableCell>
              <TableCell>
                {t('admin.siteEvents.colSubject', 'Subject')}
              </TableCell>
              <TableCell>{t('admin.siteEvents.colViewer', 'Viewer')}</TableCell>
              <TableCell>
                {t('admin.siteEvents.colMetadata', 'Metadata')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {listLoading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <CircularProgress size={28} sx={{ my: 2 }} />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  {t('admin.siteEvents.empty', 'No events match these filters.')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {new Date(row.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>{row.event_type}</TableCell>
                  <TableCell>{formatSubject(row)}</TableCell>
                  <TableCell
                    title={row.viewer_id}
                    sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {formatViewer(row)}
                  </TableCell>
                  <TableCell
                    title={JSON.stringify(row.metadata)}
                    sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {truncate(JSON.stringify(row.metadata ?? {}), 80)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[25, 50, 100]}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>
    </Container>
  );
};

export default AdminSiteEventsPage;
