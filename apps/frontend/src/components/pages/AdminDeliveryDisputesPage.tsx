import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';
import SEOHead from '../seo/SEOHead';

export type DisputeResolution = 'complete' | 'agent_fault' | 'item_fault' | 'client_fault';

export interface DeliveryReport {
  id: string;
  report_type: string;
  reason: string;
  note?: string | null;
  photo_urls?: string[] | null;
  phase: string;
  outcome: string;
  resolution?: string | null;
  created_at: string;
}

export interface DisputeRow {
  order: {
    id: string;
    order_number: string;
    current_status: string;
    currency?: string;
    total_amount?: number;
    delivered_at?: string | null;
    dispute_type?: string | null;
    dispute_reason?: string | null;
    dispute_opened_at?: string | null;
    client?: { user?: { first_name?: string; last_name?: string; phone_number?: string } };
    assigned_agent?: { user?: { first_name?: string; last_name?: string } } | null;
    business?: { name?: string } | null;
  };
  reports: DeliveryReport[];
  clientUnsupportedReports: number;
  clientFlagged: boolean;
}

export const RESOLUTIONS: DisputeResolution[] = [
  'complete',
  'agent_fault',
  'item_fault',
  'client_fault',
];

const fullName = (u?: { first_name?: string; last_name?: string }) =>
  [u?.first_name, u?.last_name].filter(Boolean).join(' ') || '—';

const AdminDeliveryDisputesPage: React.FC = () => {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const [scope, setScope] = useState<'open' | 'all'>('open');
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<DisputeRow | null>(null);
  const [resolution, setResolution] = useState<DisputeResolution>('complete');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!apiClient) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/admin/delivery-disputes?scope=${scope}`);
      setRows(res.data.disputes ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [apiClient, scope]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!apiClient || !active) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`/admin/delivery-disputes/${active.order.id}/resolve`, {
        resolution,
        note: note.trim() || undefined,
      });
      setActive(null);
      setNote('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <SEOHead title={t('adminDeliveryDisputes.title', 'Delivery reports')} />
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">{t('adminDeliveryDisputes.title', 'Delivery reports')}</Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={scope}
          onChange={(_, v) => v && setScope(v)}
        >
          <ToggleButton value="open">{t('adminDeliveryDisputes.open', 'Open')}</ToggleButton>
          <ToggleButton value="all">{t('adminDeliveryDisputes.all', 'All')}</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Typography variant="body2" color="text.secondary" mb={2}>
        {t(
          'adminDeliveryDisputes.help',
          'Reported orders never auto-complete. The courier payment waits until you resolve the report here.'
        )}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Skeleton variant="rectangular" height={160} />
      ) : rows.length === 0 ? (
        <Alert severity="success">{t('adminDeliveryDisputes.empty', 'No open delivery reports.')}</Alert>
      ) : (
        <Stack spacing={2}>
          {rows.map((row) => (
            <Card key={row.order.id} variant="outlined" data-testid="dispute-row">
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" mb={1}>
                  <Typography
                    component={RouterLink}
                    to={`/admin/orders/${row.order.id}`}
                    variant="subtitle1"
                    fontWeight={600}
                  >
                    #{row.order.order_number}
                  </Typography>
                  <Chip size="small" label={row.order.current_status} />
                  {row.order.dispute_type && (
                    <Chip
                      size="small"
                      color={row.order.dispute_type === 'delivery_failed' ? 'error' : 'warning'}
                      label={`${row.order.dispute_type} · ${row.order.dispute_reason ?? ''}`}
                    />
                  )}
                  {row.clientFlagged && (
                    <Chip
                      size="small"
                      color="error"
                      variant="outlined"
                      data-testid="client-flag"
                      label={t('adminDeliveryDisputes.flagged', 'Repeat unsupported reports: {{count}}', {
                        count: row.clientUnsupportedReports,
                      })}
                    />
                  )}
                </Stack>
                <Typography variant="body2">
                  {t('adminDeliveryDisputes.client', 'Client')}: {fullName(row.order.client?.user)} ·{' '}
                  {t('adminDeliveryDisputes.courier', 'Courier')}: {fullName(row.order.assigned_agent?.user)} ·{' '}
                  {row.order.business?.name ?? ''}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('adminDeliveryDisputes.delivered', 'Delivered')}: {row.order.delivered_at ?? '—'} ·{' '}
                  {t('adminDeliveryDisputes.reported', 'Reported')}: {row.order.dispute_opened_at ?? '—'}
                </Typography>
                {row.reports.map((r) => (
                  <Box key={r.id} sx={{ mt: 1, pl: 1, borderLeft: 2, borderColor: 'divider' }}>
                    <Typography variant="body2">
                      {r.report_type} / {r.reason} ({r.phase}) — {r.outcome}
                    </Typography>
                    {r.note && <Typography variant="body2" color="text.secondary">{r.note}</Typography>}
                    {(r.photo_urls ?? []).map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>
                        {t('adminDeliveryDisputes.photo', 'Photo')}
                      </a>
                    ))}
                  </Box>
                ))}
                {row.order.current_status === 'disputed' && (
                  <Button sx={{ mt: 1 }} variant="contained" size="small" onClick={() => setActive(row)}>
                    {t('adminDeliveryDisputes.resolve', 'Resolve')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
      <Dialog open={!!active} onClose={() => !saving && setActive(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {t('adminDeliveryDisputes.resolveTitle', 'Resolve #{{n}}', { n: active?.order.order_number })}
        </DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            margin="normal"
            label={t('adminDeliveryDisputes.resolution', 'Resolution')}
            value={resolution}
            onChange={(e) => setResolution(e.target.value as DisputeResolution)}
          >
            {RESOLUTIONS.map((r) => (
              <MenuItem key={r} value={r}>
                {t(`adminDeliveryDisputes.res.${r}`, {
                  complete: 'Delivered — complete the order (pays seller balance and courier)',
                  agent_fault: 'Not delivered — courier at fault',
                  item_fault: 'Item problem — seller at fault',
                  client_fault: 'Client at fault',
                }[r])}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            multiline
            minRows={2}
            margin="normal"
            label={t('adminDeliveryDisputes.note', 'Note')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActive(null)} disabled={saving}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="contained" onClick={submit} disabled={saving}>
            {t('adminDeliveryDisputes.confirm', 'Confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminDeliveryDisputesPage;
