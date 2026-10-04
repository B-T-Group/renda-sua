import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TablePagination,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ObjectiveProgressList } from '../../accounts/ObjectiveProgressList';
import { useApiClient } from '../../../hooks/useApiClient';
import type { ScheduleAssignmentDetail } from '../../../hooks/usePaymentScheduleDetail';

const PAGE_SIZE = 20;

interface ProgressRow extends ScheduleAssignmentDetail {
  agentName: string;
}

export function AssignmentProgressSection() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<ProgressRow | null>(null);
  const page = useProgressPage(query, offset);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim();
      setQuery((current) => {
        if (current !== next) setOffset(0);
        return next;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <Stack spacing={2}>
      <TextField
        label={t('admin.paymentPrograms.searchAgent', 'Search agent name')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        size="small"
        sx={{ maxWidth: 360 }}
      />
      {page.error ? (
        <Alert severity="error">
          {t('admin.paymentPrograms.progressLoadFailed', 'Could not load objective progress.')}
        </Alert>
      ) : null}
      {page.loading ? <CircularProgress size={28} /> : null}
      {!page.loading && !page.rows.length ? (
        <Alert severity="info">
          {t(
            'admin.paymentPrograms.emptyProgress',
            'No accepted plans with objectives.'
          )}
        </Alert>
      ) : null}
      {page.rows.map((row) => (
        <ProgressCard key={row.id} row={row} onOpen={() => setSelected(row)} />
      ))}
      {page.total > PAGE_SIZE ? (
        <TablePagination
          component="div"
          count={page.total}
          page={Math.floor(offset / PAGE_SIZE)}
          onPageChange={(_event, next) => setOffset(next * PAGE_SIZE)}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[PAGE_SIZE]}
        />
      ) : null}
      <ProgressDialog row={selected} onClose={() => setSelected(null)} />
    </Stack>
  );
}

function useProgressPage(search: string, offset: number) {
  const api = useApiClient();
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void api
      .get('/admin/payment-programs/assignments/progress', {
        params: { search: search || undefined, limit: PAGE_SIZE, offset },
      })
      .then((response) => {
        if (cancelled) return;
        const body = response.data ?? {};
        setRows(body.items ?? []);
        setTotal(Number(body.total ?? 0));
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
        setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, offset, search]);

  return { rows, total, loading, error };
}

function ProgressCard({ row, onOpen }: { row: ProgressRow; onOpen: () => void }) {
  const { t } = useTranslation();
  const overall = row.progress.overallPercent ?? 0;
  return (
    <Card variant="outlined">
      <CardActionArea onClick={onOpen}>
        <CardContent>
          <ProgressHeading row={row} overall={overall} />
          {row.progress.nextObjective == null ? (
            <Typography variant="body2" sx={{ mb: 1 }}>
              {t('admin.paymentPrograms.allObjectivesMet', 'All objectives met')}
            </Typography>
          ) : null}
          <ObjectiveProgressList progress={row.progress} currency={row.currency} showPercent />
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function ProgressHeading({ row, overall }: { row: ProgressRow; overall: number }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.5 }}>
      <Typography variant="subtitle1">{row.agentName}</Typography>
      <Typography variant="body2" color="text.secondary">
        {row.schedule.name}
      </Typography>
      <Chip size="small" label={t(`admin.paymentPrograms.${row.status}`, row.status)} />
      <Typography variant="body2">
        {t('accounts.schedules.focus.overall', '{{percent}}% overall', { percent: overall })}
      </Typography>
    </Box>
  );
}

function ProgressDialog({
  row,
  onClose,
}: {
  row: ProgressRow | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={!!row} onClose={onClose} fullWidth maxWidth="sm">
      {row ? <ProgressDialogBody row={row} /> : null}
      <DialogActions>
        <Button onClick={onClose}>{t('common.close', 'Close')}</Button>
      </DialogActions>
    </Dialog>
  );
}

function ProgressDialogBody({ row }: { row: ProgressRow }) {
  const { t } = useTranslation();
  const windowLabel = row.progressWindow
    ? `${formatDay(row.progressWindow.from)} – ${formatDay(row.progressWindow.to)}`
    : '';
  return (
    <>
      <DialogTitle>{row.agentName}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Typography variant="body2">
            {row.schedule.name} · {row.amount} {row.currency} · {row.schedule.frequency}
          </Typography>
          {windowLabel ? (
            <Typography variant="body2" color="text.secondary">
              {t('admin.paymentPrograms.progressWindow', 'Progress window')}: {windowLabel}
            </Typography>
          ) : null}
          <ObjectiveProgressList progress={row.progress} currency={row.currency} showPercent />
        </Stack>
      </DialogContent>
    </>
  );
}

function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString();
}
