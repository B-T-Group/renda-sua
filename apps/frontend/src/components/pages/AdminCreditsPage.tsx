import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { ACTIVE_PHONE_COUNTRY_OPTIONS } from '../../constants/activeCountries';
import { PlatformPermissions } from '../../constants/platformPermissions';
import {
  useAdminCredits,
  type CreditsFeedbackOrderRow,
  type CreditsSummaryRow,
  type CreditEventType,
} from '../../hooks/useAdminCredits';
import { usePermission } from '../../hooks/usePermissions';
import {
  RecordFeedbackDialog,
  type RecordFeedbackPayload,
} from '../admin/orders/RecordFeedbackDialog';
import {
  ResolveEscalationDialog,
  type ResolveEscalationPayload,
} from '../admin/orders/ResolveEscalationDialog';
import SEOHead from '../seo/SEOHead';

const EVENT_LABELS: Record<CreditEventType, [string, string]> = {
  escalation_resolved: ['admin.credits.events.escalation', 'Escalation resolved'],
  business_referred: ['admin.credits.events.businessReferred', 'Business referred'],
  agent_referred: ['admin.credits.events.agentReferred', 'Agent referred'],
  cancelled_feedback: [
    'admin.credits.events.cancelledFeedback',
    'Cancelled feedback',
  ],
  first_order_completed_feedback: [
    'admin.credits.events.firstOrderFeedback',
    'First-order feedback',
  ],
  my_first_purchase: ['admin.credits.events.firstPurchase', 'First purchase'],
};

const COUNTRY_LABELS: Record<string, [string, string]> = {
  CM: ['admin.credits.countries.CM', 'Cameroon'],
  GA: ['admin.credits.countries.GA', 'Gabon'],
  CA: ['admin.credits.countries.CA', 'Canada'],
  US: ['admin.credits.countries.US', 'United States'],
};

function countryLabel(
  code: string | null | undefined,
  t: (key: string, fallback: string) => string
): string {
  if (!code) return '—';
  const normalized = code.toUpperCase();
  const entry = COUNTRY_LABELS[normalized];
  return entry ? t(entry[0], entry[1]) : normalized;
}

export const AdminCreditsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const canAccess = usePermission(PlatformPermissions.OPS_CREDITS);
  const {
    loadSummary,
    loadEscalations,
    loadCancelled,
    loadFirstOrder,
    resolveEscalation,
    submitCancelledFeedback,
    submitFirstOrderFeedback,
  } = useAdminCredits();
  const [tab, setTab] = useState(0);
  const [country, setCountry] = useState('');
  const [summary, setSummary] = useState<CreditsSummaryRow[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [escalations, setEscalations] = useState<any[]>([]);
  const [cancelled, setCancelled] = useState<CreditsFeedbackOrderRow[]>([]);
  const [firstOrders, setFirstOrders] = useState<CreditsFeedbackOrderRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [feedbackOrderId, setFeedbackOrderId] = useState<string | null>(null);
  const [feedbackMode, setFeedbackMode] = useState<
    'cancelled' | 'first-order' | null
  >(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const feedbackOrder = useMemo(() => {
    if (!feedbackOrderId) return null;
    const rows = feedbackMode === 'cancelled' ? cancelled : firstOrders;
    return rows.find((r) => r.id === feedbackOrderId) ?? null;
  }, [feedbackOrderId, feedbackMode, cancelled, firstOrders]);

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const params = country ? { country } : undefined;
      const [s, e, c, f] = await Promise.all([
        loadSummary(params),
        loadEscalations(params),
        loadCancelled(params),
        loadFirstOrder(params),
      ]);
      setSummary(s.items);
      setWeights(s.weights ?? {});
      setEscalations(e.items);
      setCancelled(c.items);
      setFirstOrders(f.items);
    } catch (err: any) {
      enqueueSnackbar(
        err?.response?.data?.message ||
          t('admin.credits.loadFailed', 'Could not load follow-ups'),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  }, [
    country,
    loadSummary,
    loadEscalations,
    loadCancelled,
    loadFirstOrder,
    enqueueSnackbar,
    t,
  ]);

  useEffect(() => {
    if (canAccess) void reload();
  }, [canAccess, reload]);

  if (!canAccess) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="warning">
          {t('common.accessDenied', 'You do not have access to this page.')}
        </Alert>
      </Container>
    );
  }

  const onResolve = async (payload: ResolveEscalationPayload) => {
    if (!resolveId || resolving) return;
    setResolving(true);
    try {
      await resolveEscalation(resolveId, payload);
      enqueueSnackbar(
        t('admin.credits.resolveSuccess', 'Escalation resolved'),
        { variant: 'success' }
      );
      setResolveId(null);
      await reload();
    } catch (err: any) {
      enqueueSnackbar(
        err?.response?.data?.message ||
          t('admin.credits.actionFailed', 'Action failed'),
        { variant: 'error' }
      );
    } finally {
      setResolving(false);
    }
  };

  const onFeedbackSubmit = async (payload: RecordFeedbackPayload) => {
    if (!feedbackOrderId || !feedbackMode || feedbackSubmitting) return;
    setFeedbackSubmitting(true);
    try {
      const body = { notes: payload.notes, action: payload.action };
      const res =
        feedbackMode === 'cancelled'
          ? await submitCancelledFeedback(feedbackOrderId, body)
          : await submitFirstOrderFeedback(feedbackOrderId, body);
      enqueueSnackbar(feedbackSuccessMessage(payload.action, res, t), {
        variant: 'success',
      });
      setFeedbackOrderId(null);
      setFeedbackMode(null);
      await reload();
    } catch (err: any) {
      enqueueSnackbar(
        err?.response?.data?.message ||
          t('admin.credits.actionFailed', 'Action failed'),
        { variant: 'error' }
      );
      throw err;
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <SEOHead
        title={t('admin.credits.pageTitle', 'Ops follow-ups')}
        description={t(
          'admin.credits.pageDescription',
          'Escalations, call-backs, and follow-up progress'
        )}
      />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        useFlexGap
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <EmojiEventsIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            {t('admin.credits.pageTitle', 'Ops follow-ups')}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="credits-country-filter">
              {t('admin.credits.filterCountry', 'Country')}
            </InputLabel>
            <Select
              labelId="credits-country-filter"
              label={t('admin.credits.filterCountry', 'Country')}
              value={country}
              onChange={(e) => setCountry(String(e.target.value))}
            >
              <MenuItem value="">
                {t('admin.credits.allCountries', 'All countries')}
              </MenuItem>
              {ACTIVE_PHONE_COUNTRY_OPTIONS.map((opt) => (
                <MenuItem key={opt.isoCode} value={opt.isoCode}>
                  {opt.flag}{' '}
                  {t(
                    COUNTRY_LABELS[opt.isoCode][0],
                    COUNTRY_LABELS[opt.isoCode][1]
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button onClick={reload} disabled={busy}>
            {t('common.refresh', 'Refresh')}
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {Object.entries(weights).map(([key, weight]) => (
          <Chip
            key={key}
            size="small"
            label={`${t(
              EVENT_LABELS[key as CreditEventType]?.[0] ?? key,
              EVENT_LABELS[key as CreditEventType]?.[1] ?? key
            )}: ${weight}`}
          />
        ))}
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('admin.credits.tabs.escalations', 'Escalations')} />
        <Tab label={t('admin.credits.tabs.cancelled', 'Cancelled feedback')} />
        <Tab label={t('admin.credits.tabs.firstOrder', 'First-order feedback')} />
        <Tab label={t('admin.credits.tabs.progress', 'Progress')} />
      </Tabs>

      {busy ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : null}

      {!busy && tab === 0 ? (
        <EscalationsTable
          rows={escalations}
          onResolve={(id) => setResolveId(id)}
        />
      ) : null}
      {!busy && tab === 1 ? (
        <FeedbackTable
          rows={cancelled}
          mode="cancelled"
          empty={t('admin.credits.emptyCancelled', 'No cancelled orders waiting')}
          onOpen={(id) => {
            setFeedbackOrderId(id);
            setFeedbackMode('cancelled');
          }}
        />
      ) : null}
      {!busy && tab === 2 ? (
        <FeedbackTable
          rows={firstOrders}
          mode="first-order"
          empty={t(
            'admin.credits.emptyFirstOrder',
            'No first-order call-backs waiting'
          )}
          onOpen={(id) => {
            setFeedbackOrderId(id);
            setFeedbackMode('first-order');
          }}
        />
      ) : null}
      {!busy && tab === 3 ? <ProgressTable rows={summary} /> : null}

      <ResolveEscalationDialog
        open={!!resolveId}
        submitting={resolving}
        onClose={() => {
          if (!resolving) setResolveId(null);
        }}
        onSubmit={onResolve}
      />

      <RecordFeedbackDialog
        open={!!feedbackOrderId}
        mode={feedbackMode}
        order={feedbackOrder}
        submitting={feedbackSubmitting}
        onClose={() => {
          if (feedbackSubmitting) return;
          setFeedbackOrderId(null);
          setFeedbackMode(null);
        }}
        onSubmit={onFeedbackSubmit}
      />
    </Container>
  );
};

const EscalationsTable: React.FC<{
  rows: any[];
  onResolve: (id: string) => void;
}> = ({ rows, onResolve }) => {
  const { t } = useTranslation();
  if (!rows.length) {
    return (
      <Alert severity="success">
        {t('admin.credits.emptyEscalations', 'No open escalations')}
      </Alert>
    );
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('admin.credits.col.order', 'Order')}</TableCell>
          <TableCell>{t('admin.credits.col.client', 'Client')}</TableCell>
          <TableCell>{t('admin.credits.col.country', 'Country')}</TableCell>
          <TableCell>{t('admin.credits.col.risk', 'Risk')}</TableCell>
          <TableCell>{t('admin.credits.col.severity', 'Severity')}</TableCell>
          <TableCell align="right">{t('common.actions', 'Actions')}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const client = row.order?.client?.user;
          const name = [client?.first_name, client?.last_name]
            .filter(Boolean)
            .join(' ');
          return (
            <TableRow key={row.id}>
              <TableCell>
                <Link
                  component={RouterLink}
                  to={`/admin/orders/${row.order_id}`}
                >
                  {row.order?.order_number ?? row.order_id}
                </Link>
              </TableCell>
              <TableCell>{name || '—'}</TableCell>
              <TableCell>{countryLabel(client?.country, t)}</TableCell>
              <TableCell>{row.risk_type}</TableCell>
              <TableCell>{row.severity}</TableCell>
              <TableCell align="right">
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => onResolve(row.id)}
                >
                  {t('admin.credits.resolveAction', 'Resolve')}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const FeedbackTable: React.FC<{
  rows: CreditsFeedbackOrderRow[];
  empty: string;
  mode: 'cancelled' | 'first-order';
  onOpen: (orderId: string) => void;
}> = ({ rows, empty, mode, onOpen }) => {
  const { t } = useTranslation();
  if (!rows.length) return <Alert severity="info">{empty}</Alert>;
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('admin.credits.col.order', 'Order')}</TableCell>
          <TableCell>{t('admin.credits.col.items', 'Items')}</TableCell>
          <TableCell>{t('admin.credits.col.client', 'Client')}</TableCell>
          <TableCell>{t('admin.credits.col.country', 'Country')}</TableCell>
          <TableCell>{t('admin.credits.col.phone', 'Phone')}</TableCell>
          <TableCell>{t('admin.credits.col.business', 'Business')}</TableCell>
          <TableCell>{t('admin.credits.col.when', 'When')}</TableCell>
          <TableCell align="right">{t('common.actions', 'Actions')}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const name = [
            row.client?.user?.first_name,
            row.client?.user?.last_name,
          ]
            .filter(Boolean)
            .join(' ');
          const when =
            mode === 'cancelled' ? row.cancelled_at : row.completed_at;
          const first = row.order_items?.[0];
          const itemLabel = first
            ? [first.item_name, first.variant_name].filter(Boolean).join(' · ')
            : '';
          const more =
            (row.order_items?.length ?? 0) > 1
              ? ` +${(row.order_items?.length ?? 0) - 1}`
              : '';
          const fulfillment =
            row.fulfillment_method === 'pickup'
              ? t('admin.credits.fulfillment.pickup', 'Pickup')
              : row.fulfillment_method === 'shipping'
                ? t('admin.credits.fulfillment.shipping', 'Shipping')
                : row.fulfillment_method === 'delivery'
                  ? t('admin.credits.fulfillment.delivery', 'Delivery')
                  : row.fulfillment_method || '—';
          return (
            <TableRow key={row.id}>
              <TableCell>
                <Link
                  component={RouterLink}
                  to={`/admin/orders/${row.id}`}
                  underline="hover"
                >
                  {row.order_number}
                </Link>
                <Typography
                  variant="caption"
                  display="block"
                  color="text.secondary"
                >
                  {fulfillment}
                </Typography>
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box
                    component="img"
                    src={first?.image_url || undefined}
                    alt=""
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1,
                      objectFit: 'cover',
                      bgcolor: 'action.selected',
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="body2">
                    {itemLabel
                      ? `${first?.quantity ?? 1}× ${itemLabel}${more}`
                      : '—'}
                  </Typography>
                </Stack>
              </TableCell>
              <TableCell>{name || '—'}</TableCell>
              <TableCell>
                {countryLabel(row.client?.user?.country, t)}
              </TableCell>
              <TableCell>{row.client?.user?.phone_number || '—'}</TableCell>
              <TableCell>{row.business?.name || '—'}</TableCell>
              <TableCell>
                {when ? new Date(when).toLocaleString() : row.current_status}
              </TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    size="small"
                    component={RouterLink}
                    to={`/admin/orders/${row.id}`}
                  >
                    {t('admin.credits.openOrder', 'Open order')}
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => onOpen(row.id)}
                  >
                    {t('admin.credits.recordFeedback', 'Record feedback')}
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const ProgressTable: React.FC<{ rows: CreditsSummaryRow[] }> = ({ rows }) => {
  const { t } = useTranslation();
  if (!rows.length) {
    return (
      <Alert severity="info">
        {t('admin.credits.emptyProgress', 'No follow-ups recorded yet')}
      </Alert>
    );
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('admin.credits.col.user', 'User')}</TableCell>
          <TableCell>{t('admin.credits.col.country', 'Country')}</TableCell>
          <TableCell>{t('admin.credits.col.roles', 'Roles')}</TableCell>
          <TableCell align="right">
            {t('admin.credits.col.weight', 'Weight')}
          </TableCell>
          <TableCell align="right">
            {t('admin.credits.col.count', 'Actions')}
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const name =
            `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() ||
            row.email ||
            row.user_id;
          return (
            <TableRow key={row.user_id}>
              <TableCell>{name}</TableCell>
              <TableCell>{countryLabel(row.country, t)}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5}>
                  {row.is_agent ? (
                    <Chip size="small" label={t('common.agent', 'Agent')} />
                  ) : null}
                  {row.is_business ? (
                    <Chip
                      size="small"
                      label={t('common.business', 'Business')}
                    />
                  ) : null}
                </Stack>
              </TableCell>
              <TableCell align="right">{row.total_weight}</TableCell>
              <TableCell align="right">{row.credit_count}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default AdminCreditsPage;

function feedbackSuccessMessage(
  action: RecordFeedbackPayload['action'],
  res: { classification?: string } | undefined,
  t: (key: string, fallback: string) => string
): string {
  const classification =
    res?.classification ??
    (action === 'test_order'
      ? 'test'
      : action === 'internal_order'
        ? 'internal'
        : null);
  if (classification === 'test') {
    return t('admin.credits.markedTest', 'Marked as test order (no points)');
  }
  if (classification === 'internal') {
    return t(
      'admin.credits.markedInternal',
      'Marked as internal order (no points)'
    );
  }
  return t('admin.credits.feedbackSaved', 'Feedback recorded');
}
