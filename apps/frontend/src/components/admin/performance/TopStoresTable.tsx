import {
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TopStoreRow } from '../../../hooks/useAdminPerformance';
import { formatPayoutMoney } from '../AdminPayoutPreviewTable';

interface TopStoresTableProps {
  stores: TopStoreRow[];
  emptyLabel: string;
}

export const TopStoresTable: React.FC<TopStoresTableProps> = ({
  stores,
  emptyLabel,
}) => {
  const { t } = useTranslation();
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5 }}>
          {t('admin.performance.platform.topStoresTitle', 'Top stores')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t(
            'admin.performance.platform.topStoresHelp',
            'The five locations that received the most orders in this period, and who referred the business.'
          )}
        </Typography>
        {stores.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {emptyLabel}
          </Typography>
        ) : (
          <StoreRows stores={stores} />
        )}
      </CardContent>
    </Card>
  );
};

const StoreRows: React.FC<{ stores: TopStoreRow[] }> = ({ stores }) => {
  const { t } = useTranslation();
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>{t('admin.performance.platform.store', 'Store')}</TableCell>
            <TableCell align="right">
              {t('admin.performance.platform.orders', 'Orders')}
            </TableCell>
            <TableCell align="right">
              {t('admin.performance.platform.completed', 'Completed')}
            </TableCell>
            <TableCell align="right">
              {t('admin.performance.platform.gmv', 'GMV')}
            </TableCell>
            <TableCell>
              {t('admin.performance.platform.referredBy', 'Referred by')}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {stores.map((store, index) => (
            <StoreRow key={store.businessLocationId} store={store} rank={index + 1} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const StoreRow: React.FC<{ store: TopStoreRow; rank: number }> = ({
  store,
  rank,
}) => (
  <TableRow hover>
    <TableCell>{rank}</TableCell>
    <TableCell>
      <Typography variant="body2" fontWeight={600}>
        {store.locationName || store.businessName}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {store.businessName}
      </Typography>
    </TableCell>
    <TableCell align="right">{store.orderCount}</TableCell>
    <TableCell align="right">{store.completedCount}</TableCell>
    <TableCell align="right">{gmvLabel(store)}</TableCell>
    <TableCell>
      <ReferrerCell store={store} />
    </TableCell>
  </TableRow>
);

function gmvLabel(store: TopStoreRow): string {
  if (!store.currency) return '—';
  return formatPayoutMoney(store.gmv, store.currency);
}

const ReferrerCell: React.FC<{ store: TopStoreRow }> = ({ store }) => {
  const { t } = useTranslation();
  const referrer = store.referrer;
  if (!referrer) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('admin.performance.platform.direct', 'Direct')}
      </Typography>
    );
  }
  const kindLabel =
    referrer.kind === 'agent'
      ? t('admin.performance.platform.referrerAgent', 'Agent')
      : t('admin.performance.platform.referrerBusiness', 'Business');
  const code = referrer.code ? ` · ${referrer.code}` : '';
  return (
    <Chip
      size="small"
      variant="outlined"
      label={`${kindLabel}: ${referrer.name || '—'}${code}`}
    />
  );
};
