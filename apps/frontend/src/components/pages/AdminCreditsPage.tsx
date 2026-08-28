import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { PlatformPermissions } from '../../constants/platformPermissions';
import {
  useAdminCredits,
  type CreditsSummaryRow,
  type CreditEventType,
} from '../../hooks/useAdminCredits';
import { usePermission } from '../../hooks/usePermissions';
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
  const [summary, setSummary] = useState<CreditsSummaryRow[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [escalations, setEscalations] = useState<any[]>([]);
  const [cancelled, setCancelled] = useState<any[]>([]);
  const [firstOrders, setFirstOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [feedbackOrderId, setFeedbackOrderId] = useState<string | null>(null);
  const [feedbackMode, setFeedbackMode] = useState<
    'cancelled' | 'first-order' | null
  >(null);
  const [feedbackNotes, setFeedbackNotes] = useState('');

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const [s, e, c, f] = await Promise.all([
        loadSummary(),
        loadEscalations(),
        loadCancelled(),
        loadFirstOrder(),
      ]);
      setSummary(s.items);
      setWeights(s.weights ?? {});
      setEscalations(e.items);
      setCancelled(c.items);
      setFirstOrders(f.items);
    } catch (err: any) {
      enqueueSnackbar(
        err?.response?.data?.message ||
          t('admin.credits.loadFailed', 'Could not load credits'),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  }, [
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

  const onFeedbackSubmit = async () => {
    if (!feedbackOrderId || !feedbackMode || !feedbackNotes.trim()) return;
    try {
      if (feedbackMode === 'cancelled') {
        await submitCancelledFeedback(feedbackOrderId, feedbackNotes.trim());
      } else {
        await submitFirstOrderFeedback(feedbackOrderId, feedbackNotes.trim());
      }
      enqueueSnackbar(
        t('admin.credits.feedbackSaved', 'Feedback recorded'),
        { variant: 'success' }
      );
      setFeedbackOrderId(null);
      setFeedbackMode(null);
      setFeedbackNotes('');
      await reload();
    } catch (err: any) {
      enqueueSnackbar(
        err?.response?.data?.message ||
          t('admin.credits.actionFailed', 'Action failed'),
        { variant: 'error' }
      );
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <SEOHead
        title={t('admin.credits.pageTitle', 'Ops credits')}
        description={t(
          'admin.credits.pageDescription',
          'Escalations, call-back feedback, and progress leaderboard'
        )}
      />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <EmojiEventsIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            {t('admin.credits.pageTitle', 'Ops credits')}
          </Typography>
        </Stack>
        <Button onClick={reload} disabled={busy}>
          {t('common.refresh', 'Refresh')}
        </Button>
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

      <Dialog
        open={!!feedbackOrderId}
        onClose={() => {
          setFeedbackOrderId(null);
          setFeedbackMode(null);
          setFeedbackNotes('');
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {feedbackMode === 'cancelled'
            ? t('admin.credits.cancelledFeedbackTitle', 'Cancelled-order feedback')
            : t('admin.credits.firstOrderFeedbackTitle', 'First-order feedback')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={t('admin.credits.feedbackNotes', 'Feedback notes')}
              value={feedbackNotes}
              onChange={(e) => setFeedbackNotes(e.target.value)}
              multiline
              minRows={4}
              fullWidth
              required
            />
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button
                onClick={() => {
                  setFeedbackOrderId(null);
                  setFeedbackMode(null);
                }}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant="contained"
                disabled={!feedbackNotes.trim()}
                onClick={onFeedbackSubmit}
              >
                {t('admin.credits.saveFeedback', 'Save feedback')}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
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
          <TableCell>{t('admin.credits.col.risk', 'Risk')}</TableCell>
          <TableCell>{t('admin.credits.col.severity', 'Severity')}</TableCell>
          <TableCell align="right">{t('common.actions', 'Actions')}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Link
                component={RouterLink}
                to={`/admin/orders/${row.order_id}`}
              >
                {row.order?.order_number ?? row.order_id}
              </Link>
            </TableCell>
            <TableCell>{row.risk_type}</TableCell>
            <TableCell>{row.severity}</TableCell>
            <TableCell align="right">
              <Button size="small" variant="contained" onClick={() => onResolve(row.id)}>
                {t('admin.credits.resolveAction', 'Resolve')}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const FeedbackTable: React.FC<{
  rows: any[];
  empty: string;
  onOpen: (orderId: string) => void;
}> = ({ rows, empty, onOpen }) => {
  const { t } = useTranslation();
  if (!rows.length) return <Alert severity="info">{empty}</Alert>;
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('admin.credits.col.order', 'Order')}</TableCell>
          <TableCell>{t('admin.credits.col.client', 'Client')}</TableCell>
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
          return (
            <TableRow key={row.id}>
              <TableCell>{row.order_number}</TableCell>
              <TableCell>
                {name || row.client?.user?.phone_number || '—'}
              </TableCell>
              <TableCell align="right">
                <Button size="small" variant="contained" onClick={() => onOpen(row.id)}>
                  {t('admin.credits.recordFeedback', 'Record feedback')}
                </Button>
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
        {t('admin.credits.emptyProgress', 'No credits awarded yet')}
      </Alert>
    );
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('admin.credits.col.user', 'User')}</TableCell>
          <TableCell>{t('admin.credits.col.roles', 'Roles')}</TableCell>
          <TableCell align="right">
            {t('admin.credits.col.weight', 'Weight')}
          </TableCell>
          <TableCell align="right">
            {t('admin.credits.col.count', 'Credits')}
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
