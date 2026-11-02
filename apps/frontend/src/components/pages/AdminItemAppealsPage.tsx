import { Refresh as RefreshIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { useItemAppealsAdmin } from '../../hooks/useItemAppealsAdmin';
import { usePermission } from '../../hooks/usePermissions';
import type { AppealQueueStatus } from '../../types/itemAppealsAdmin';
import type { RejectionCategory } from '../../types/itemRejectionRecovery';
import {
  categoryDefaultLabel,
  categoryLabelKey,
} from '../../utils/itemRejectionRecovery';
import { AppealSlaBadge } from '../admin/AppealSlaBadge';
import { RejectionCategorySelect } from '../admin/RejectionCategorySelect';

const PAGE_SIZE = 50;

const AdminItemAppealsPage: React.FC = () => {
  const { t } = useTranslation();
  const isAdmin = usePermission(PlatformPermissions.MODERATE_ITEMS);
  const { queue, counts, loading, error, fetchQueue, fetchCounts } =
    useItemAppealsAdmin();
  const [status, setStatus] = useState<AppealQueueStatus>('pending');
  const [category, setCategory] = useState<RejectionCategory | ''>('');
  const [businessId, setBusinessId] = useState('');
  const [offset, setOffset] = useState(0);

  const reload = useCallback(() => {
    void fetchCounts();
    void fetchQueue({
      status,
      category: category || undefined,
      businessId: businessId.trim() || undefined,
      limit: PAGE_SIZE,
      offset,
    });
  }, [businessId, category, fetchCounts, fetchQueue, offset, status]);

  useEffect(() => {
    if (isAdmin) reload();
  }, [isAdmin, reload]);

  if (!isAdmin) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography color="error" variant="h6">
          {t('admin.itemAppeals.accessDenied', 'Access denied')}
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <AppealsHeader
        pending={counts?.pending ?? 0}
        breached={counts?.breached ?? 0}
        loading={loading}
        onRefresh={reload}
      />
      <AppealsFilters
        status={status}
        category={category}
        businessId={businessId}
        onStatus={(next) => {
          setOffset(0);
          setStatus(next);
        }}
        onCategory={(next) => {
          setOffset(0);
          setCategory(next);
        }}
        onBusinessId={setBusinessId}
      />
      <Card>
        <CardContent>
          <AppealsTable loading={loading} error={error} queue={queue} />
          {queue && queue.total > PAGE_SIZE ? (
            <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'center' }}>
              <Button
                size="small"
                disabled={offset === 0 || loading}
                onClick={() => setOffset((n) => Math.max(0, n - PAGE_SIZE))}
              >
                {t('common.previous', { defaultValue: 'Previous' })}
              </Button>
              <Typography variant="body2">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, queue.total)} / {queue.total}
              </Typography>
              <Button
                size="small"
                disabled={offset + PAGE_SIZE >= queue.total || loading}
                onClick={() => setOffset((n) => n + PAGE_SIZE)}
              >
                {t('common.next', { defaultValue: 'Next' })}
              </Button>
            </Box>
          ) : null}
        </CardContent>
      </Card>
    </Container>
  );
};

function AppealsHeader({
  pending,
  breached,
  loading,
  onRefresh,
}: {
  pending: number;
  breached: number;
  loading: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
      <Typography variant="h5" sx={{ flex: 1, minWidth: 200 }}>
        {t('admin.itemAppeals.pageTitle', 'Item appeals')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('admin.itemAppeals.queueCount', '{{pending}} pending · {{breached}} past SLA', {
          pending,
          breached,
          defaultValue: `${pending} pending · ${breached} past SLA`,
        })}
      </Typography>
      <Button component={RouterLink} to="/admin/items/moderation" variant="text">
        {t('admin.itemAppeals.backToModeration', 'Item moderation')}
      </Button>
      <Button startIcon={<RefreshIcon />} variant="outlined" onClick={onRefresh} disabled={loading}>
        {t('admin.itemAppeals.refresh', 'Refresh')}
      </Button>
    </Box>
  );
}

function AppealsFilters({
  status,
  category,
  businessId,
  onStatus,
  onCategory,
  onBusinessId,
}: {
  status: AppealQueueStatus;
  category: RejectionCategory | '';
  businessId: string;
  onStatus: (value: AppealQueueStatus) => void;
  onCategory: (value: RejectionCategory | '') => void;
  onBusinessId: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>{t('admin.itemAppeals.statusFilter', 'Status')}</InputLabel>
        <Select
          label={t('admin.itemAppeals.statusFilter', 'Status')}
          value={status}
          onChange={(e) => onStatus(e.target.value as AppealQueueStatus)}
        >
          <MenuItem value="pending">{t('admin.itemAppeals.status.pending', 'Pending')}</MenuItem>
          <MenuItem value="upheld">{t('admin.itemAppeals.status.upheld', 'Upheld')}</MenuItem>
          <MenuItem value="overturned">{t('admin.itemAppeals.status.overturned', 'Overturned')}</MenuItem>
          <MenuItem value="withdrawn">{t('admin.itemAppeals.status.withdrawn', 'Withdrawn')}</MenuItem>
        </Select>
      </FormControl>
      <Box sx={{ minWidth: 220 }}>
        <RejectionCategorySelect
          value={category}
          onChange={onCategory}
          required={false}
          label={t('admin.itemAppeals.categoryFilter', 'Category')}
        />
      </Box>
      <TextField
        size="small"
        label={t('admin.itemAppeals.businessFilter', 'Business id')}
        value={businessId}
        onChange={(e) => onBusinessId(e.target.value)}
      />
    </Box>
  );
}

function AppealsTable({
  loading,
  error,
  queue,
}: {
  loading: boolean;
  error: string | null;
  queue: ReturnType<typeof useItemAppealsAdmin>['queue'];
}) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Typography color="error" sx={{ py: 2 }}>
        {t('admin.itemAppeals.loadError', 'Could not load appeals')}: {error}
      </Typography>
    );
  }
  if (!queue?.appeals.length) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        {t('admin.itemAppeals.empty', 'No appeals in this queue')}
      </Typography>
    );
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('admin.itemAppeals.itemName', 'Sale item')}</TableCell>
          <TableCell>{t('admin.itemAppeals.business', 'Business')}</TableCell>
          <TableCell>{t('admin.itemAppeals.category', 'Category')}</TableCell>
          <TableCell>{t('admin.itemAppeals.sla', 'SLA')}</TableCell>
          <TableCell align="right">{t('common.actions', { defaultValue: 'Actions' })}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {queue.appeals.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.item.name}</TableCell>
            <TableCell>{row.business?.name ?? '—'}</TableCell>
            <TableCell>
              {row.rejection?.category
                ? t(
                    categoryLabelKey(row.rejection.category),
                    categoryDefaultLabel(row.rejection.category)
                  )
                : '—'}
            </TableCell>
            <TableCell>
              <AppealSlaBadge state={row.slaState} dueAt={row.slaDueAt} />
            </TableCell>
            <TableCell align="right">
              <Button size="small" component={RouterLink} to={`/admin/item-appeals/${row.id}`}>
                {t('admin.itemAppeals.review', 'Review')}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default AdminItemAppealsPage;
