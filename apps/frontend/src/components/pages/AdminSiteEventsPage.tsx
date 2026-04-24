import { FilterList, ExpandMore } from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { endOfDay, startOfDay, subDays } from 'date-fns';
import { enUS, fr as frDfn } from 'date-fns/locale';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  type AdminSiteEventRow,
  type AdminSiteEventSummary,
  type SummaryGroupBy,
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
  if (!d) return undefined;
  return startOfDay(d).toISOString();
}

function toToIso(d: Date | null): string | undefined {
  if (!d) return undefined;
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
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function eventTypeChipColor(et: string) {
  if (et.includes('buy_now')) return 'error' as const;
  if (et.includes('order_now')) return 'primary' as const;
  if (et.includes('browse')) return 'success' as const;
  return 'default' as const;
}

function SubjectCell({ row, t }: { row: AdminSiteEventRow; t: (a: string, b: string) => string }) {
  if (!row.subject_type && !row.subject_id) {
    return <Typography variant="body2">—</Typography>;
  }
  if (row.subject_type === 'inventory_item' && row.subject_id) {
    const name = row.subject_display_name?.trim();
    return (
      <Box sx={{ maxWidth: 360 }}>
        <Typography variant="body2" fontWeight={600} noWrap title={name ?? undefined}>
          {name || t('admin.siteEvents.subject.unnamed', 'Unnamed product')}
        </Typography>
        <Tooltip title={row.subject_id}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block' }} noWrap>
            {row.subject_id.length > 24
              ? `${row.subject_id.slice(0, 10)}…${row.subject_id.slice(-6)}`
              : row.subject_id}
          </Typography>
        </Tooltip>
      </Box>
    );
  }
  return (
    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
      {row.subject_type} {row.subject_id}
    </Typography>
  );
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
  const [summaryGroupBy, setSummaryGroupBy] = useState<SummaryGroupBy>('eventType');
  const [items, setItems] = useState<AdminSiteEventRow[]>([]);
  const [summary, setSummary] = useState<AdminSiteEventSummary>({
    total: 0,
    groupBy: 'eventType',
    byEventType: [],
    byInventoryItem: [],
    byEventAndSubject: [],
    inventoryEventTotal: 0,
    inventorySummaryTruncated: false,
    eventSubjectSummaryTruncated: false,
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
      fetchSummary(q, summaryGroupBy),
    ]);
    setItems(data.items);
    setTotal(data.total);
    setSummary(sum);
  }, [fetchList, fetchSummary, page, rowsPerPage, applied, summaryGroupBy]);

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

  const inventoryItemTitle = useMemo(
    () => (row: { itemName: string | null; inventoryItemId: string }) => {
      if (row.itemName?.trim()) {
        return truncate(row.itemName.trim(), 42);
      }
      return truncate(row.inventoryItemId, 20);
    },
    []
  );

  const tBind = (a: string, b: string) => t(a, b);

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
          {t('admin.siteEvents.noBusinessProfile', 'Business profile not found')}
        </Typography>
      </Container>
    );
  }

  if (!profile.business.is_admin) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography color="error">
          {t('admin.siteEvents.unauthorized', 'You are not authorized to access this page')}
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <SEOHead
        title={t('admin.siteEvents.pageTitle', 'Site events')}
        description={t('admin.siteEvents.pageDescription', 'Browse site analytics events.')}
        keywords={t('admin.siteEvents.pageKeywords', 'admin, analytics, site events, export')}
      />

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <FilterList color="action" fontSize="small" />
        <Typography variant="h5" component="h1" fontWeight={700}>
          {t('admin.siteEvents.pageTitle', 'Site events')}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        {t(
          'admin.siteEvents.pageDescription',
          'See aggregated activity, then review each event. Default period is the last 7 full days. Filters apply to both the chart and the table below.'
        )}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          mb: 2,
          borderRadius: 2,
          backgroundColor: (th) => th.palette.action.hover,
        }}
      >
        <Stack
          direction="row"
          flexWrap="wrap"
          alignItems="center"
          justifyContent="space-between"
          gap={2}
          sx={{ mb: 1 }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('admin.siteEvents.summary.title', 'Activity summary')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {summaryGroupBy === 'eventType'
                ? t('admin.siteEvents.summary.caption', 'By event type.')
                : summaryGroupBy === 'inventoryItem'
                  ? t('admin.siteEvents.summary.captionByProduct', 'By inventory product (top 40).')
                  : t(
                      'admin.siteEvents.summary.captionEventSubject',
                      'By each CTA + subject pair (top 50), e.g. same product with different actions count separately.'
                    )}
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {t('admin.siteEvents.aggregateBy', 'Aggregate by')}
            </Typography>
            <ToggleButtonGroup
              size="small"
              value={summaryGroupBy}
              exclusive
              onChange={(_, v) => v && setSummaryGroupBy(v)}
              sx={{ flexWrap: 'wrap' }}
            >
              <ToggleButton value="eventType">
                {t('admin.siteEvents.aggregate.eventType', 'Event type')}
              </ToggleButton>
              <ToggleButton value="eventAndSubject">
                {t('admin.siteEvents.aggregate.eventAndSubject', 'CTA + subject')}
              </ToggleButton>
              <ToggleButton value="inventoryItem">
                {t('admin.siteEvents.aggregate.inventoryItem', 'Product')}
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Stack>

        {(summary.inventorySummaryTruncated || summary.eventSubjectSummaryTruncated) && (
          <Alert severity="warning" sx={{ mb: 1 }}>
            {t(
              'admin.siteEvents.summary.truncatedWarning',
              'Very large data volume: the breakdown may be partial. Narrow the date range for a full count.'
            )}
          </Alert>
        )}

        {listLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={2}
            alignItems="flex-start"
          >
            {summary.total > 0 &&
              summaryGroupBy === 'eventAndSubject' &&
              summary.byEventAndSubject.length > 0 && (
              <Box sx={{ width: { xs: '100%', lg: '50%' } }}>
                <SiteEventSummaryChart
                  summary={summary}
                  eventTypeLabel={eventTypeLabel}
                  inventoryItemTitle={inventoryItemTitle}
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ textAlign: 'center', mt: 0.5 }}>
                  {t('admin.siteEvents.chart.captionEventSubject', 'Each slice: one CTA + one subject (e.g. one product).')}
                </Typography>
              </Box>
            )}
            {summary.total > 0 && summaryGroupBy === 'eventType' && (
              <Box sx={{ width: { xs: '100%', lg: '50%' } }}>
                <SiteEventSummaryChart
                  summary={summary}
                  eventTypeLabel={eventTypeLabel}
                  inventoryItemTitle={inventoryItemTitle}
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ textAlign: 'center', mt: 0.5 }}>
                  {t('admin.siteEvents.chart.caption', 'Donut: share. Bar: counts.')}
                </Typography>
              </Box>
            )}
            {summary.total > 0 && summaryGroupBy === 'inventoryItem' && summary.byInventoryItem.length > 0 && (
              <Box sx={{ width: { xs: '100%', lg: '50%' } }}>
                <SiteEventSummaryChart
                  summary={summary}
                  eventTypeLabel={eventTypeLabel}
                  inventoryItemTitle={inventoryItemTitle}
                />
                {summary.inventoryEventTotal > 0 && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ textAlign: 'center' }}>
                    {t('admin.siteEvents.inventoryEventTotal', {
                      n: summary.inventoryEventTotal,
                      defaultValue: 'Events on catalog products (in range): {{n}}',
                    })}
                  </Typography>
                )}
              </Box>
            )}

            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{
                width: { xs: '100%', lg: summary.total > 0 ? '50%' : '100%' },
                borderRadius: 1,
              }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>
                      {summaryGroupBy === 'eventAndSubject'
                        ? t('admin.siteEvents.summary.colEventSubject', 'CTA & subject')
                        : t('admin.siteEvents.summary.colMetric', 'Metric')}
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
                    <TableCell align="right">
                      <Typography fontWeight={600} component="span">
                        {summary.total}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  {summary.total === 0 && (
                    <TableRow>
                      <TableCell colSpan={2}>
                        {t('admin.siteEvents.summary.empty', 'No events in this range.')}
                      </TableCell>
                    </TableRow>
                  )}
                  {summary.total > 0 &&
                    summaryGroupBy === 'eventType' &&
                    summary.byEventType.length === 0 &&
                    applied.eventType && (
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
                  )}
                  {summaryGroupBy === 'eventType' &&
                    summary.byEventType.map((row) => (
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
                  {summaryGroupBy === 'inventoryItem' &&
                    summary.total > 0 &&
                    summary.byInventoryItem.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2}>
                        <Typography variant="body2" color="text.secondary">
                          {t(
                            'admin.siteEvents.summary.noProductScoped',
                            'No product-scoped events in this range (or none matched filters).'
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {summaryGroupBy === 'inventoryItem' &&
                    summary.byInventoryItem.map((row) => (
                      <TableRow key={row.inventoryItemId}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {row.itemName || t('admin.siteEvents.subject.unnamed', 'Unnamed product')}
                          </Typography>
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontFamily: 'monospace' }}
                            title={row.inventoryItemId}
                          >
                            {truncate(row.inventoryItemId, 12)}…{row.inventoryItemId.slice(-6)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{row.count}</TableCell>
                      </TableRow>
                    ))}
                  {summaryGroupBy === 'eventAndSubject' &&
                    summary.byEventAndSubject.map((row) => {
                      const subTitle =
                        row.subjectDisplayName?.trim() ||
                        [row.subjectType, row.subjectId].filter(Boolean).join(' ') ||
                        '—';
                      return (
                        <TableRow
                          key={`${row.eventType}-${row.subjectType ?? ''}-${row.subjectId ?? ''}`}
                        >
                          <TableCell>
                            <Chip
                              size="small"
                              label={truncate(row.eventType, 40)}
                              color={eventTypeChipColor(row.eventType)}
                              variant="outlined"
                              sx={{ mb: 0.5, display: 'block', width: 'fit-content' }}
                            />
                            <Typography variant="body2" fontWeight={600} display="block">
                              {subTitle}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{row.count}</TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </Paper>

      <Accordion
        defaultExpanded
        disableGutters
        elevation={0}
        sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 2, '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <FilterList fontSize="small" color="action" />
            <Typography fontWeight={600}>
              {t('admin.siteEvents.filtersTitle', 'Filters & export')}
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2} direction="row" flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              label={t('admin.siteEvents.eventType', 'Event type')}
              value={draft.eventType}
              onChange={(e) => setDraft((d) => ({ ...d, eventType: e.target.value }))}
              placeholder="inventory.cta.…"
              sx={{ minWidth: 220 }}
            />
            <TextField
              size="small"
              label={t('admin.siteEvents.subjectType', 'Subject type')}
              value={draft.subjectType}
              onChange={(e) => setDraft((d) => ({ ...d, subjectType: e.target.value }))}
              sx={{ minWidth: 160 }}
            />
            <TextField
              size="small"
              label={t('admin.siteEvents.inventoryItemId', 'Inventory item ID')}
              value={draft.subjectId}
              onChange={(e) => setDraft((d) => ({ ...d, subjectId: e.target.value }))}
              placeholder="UUID"
              sx={{ minWidth: 280 }}
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
              startIcon={exportLoading ? <CircularProgress color="inherit" size={18} /> : undefined}
            >
              {t('admin.siteEvents.exportCsv', 'Export CSV')}
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ borderRadius: 2, overflow: 'auto' }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell width={180}>{t('admin.siteEvents.colTime', 'Time')}</TableCell>
              <TableCell>{t('admin.siteEvents.colEvent', 'Event')}</TableCell>
              <TableCell sx={{ minWidth: 220 }}>
                {t('admin.siteEvents.colSubject', 'Subject')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {listLoading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>
                  {t('admin.siteEvents.empty', 'No events match these filters.')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {new Date(row.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={truncate(row.event_type, 36)}
                      color={eventTypeChipColor(row.event_type)}
                      variant="outlined"
                      sx={{ maxWidth: 320, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                    />
                  </TableCell>
                  <TableCell>
                    <SubjectCell row={row} t={tBind} />
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
