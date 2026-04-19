import {
  Alert,
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
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  type AdminSiteEventRow,
  useAdminSiteEventsApi,
} from '../../hooks/useAdminSiteEvents';
import LoadingScreen from '../common/LoadingScreen';
import SEOHead from '../seo/SEOHead';

type FilterForm = {
  eventType: string;
  subjectType: string;
  subjectId: string;
  from: string;
  to: string;
};

const emptyFilters: FilterForm = {
  eventType: '',
  subjectType: '',
  subjectId: '',
  from: '',
  to: '',
};

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function formatSubject(row: AdminSiteEventRow): string {
  if (!row.subject_type && !row.subject_id) return '—';
  return `${row.subject_type ?? ''} ${row.subject_id ?? ''}`.trim();
}

function formatViewer(row: AdminSiteEventRow): string {
  return `${row.viewer_type}: ${truncate(row.viewer_id, 48)}`;
}

const AdminSiteEventsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile, loading: profileLoading, error: profileError } =
    useUserProfileContext();
  const { fetchList, exportCsv, listLoading, exportLoading, error } =
    useAdminSiteEventsApi();

  const [draft, setDraft] = useState<FilterForm>(() => ({ ...emptyFilters }));
  const [applied, setApplied] = useState<FilterForm>(() => ({ ...emptyFilters }));
  const [items, setItems] = useState<AdminSiteEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const load = useCallback(async () => {
    const data = await fetchList({
      limit: rowsPerPage,
      offset: page * rowsPerPage,
      eventType: applied.eventType || undefined,
      subjectType: applied.subjectType || undefined,
      subjectId: applied.subjectId || undefined,
      from: applied.from || undefined,
      to: applied.to || undefined,
    });
    setItems(data.items);
    setTotal(data.total);
  }, [fetchList, page, rowsPerPage, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const onApply = () => {
    setApplied({ ...draft });
    setPage(0);
  };

  const onExport = async () => {
    try {
      await exportCsv({
        eventType: applied.eventType || undefined,
        subjectType: applied.subjectType || undefined,
        subjectId: applied.subjectId || undefined,
        from: applied.from || undefined,
        to: applied.to || undefined,
      });
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
          'Browse client-side analytics events (CTAs, future signals). Export CSV for warehouse or spreadsheets.'
        )}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

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
          <TextField
            size="small"
            label={t('admin.siteEvents.from', 'From (ISO)')}
            value={draft.from}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            sx={{ minWidth: 200 }}
          />
          <TextField
            size="small"
            label={t('admin.siteEvents.to', 'To (ISO)')}
            value={draft.to}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            sx={{ minWidth: 200 }}
          />
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
