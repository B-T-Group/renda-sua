import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PlatformSalesRow } from '../../../hooks/useAdminPerformance';
import { formatPayoutMoney } from '../AdminPayoutPreviewTable';

interface PlatformSalesCardProps {
  sales: PlatformSalesRow[];
  emptyLabel: string;
}

function money(amount: number, currency: string): string {
  return formatPayoutMoney(amount, currency);
}

export const PlatformSalesCard: React.FC<PlatformSalesCardProps> = ({
  sales,
  emptyLabel,
}) => {
  const { t } = useTranslation();
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" fontWeight={600}>
          {t('admin.performance.platform.salesTitle', 'Sales')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t(
            'admin.performance.platform.salesHelp',
            'Gross merchandise value is completed orders. Collected is orders marked paid.'
          )}
        </Typography>
        {sales.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {emptyLabel}
          </Typography>
        ) : (
          <Stack spacing={2}>
            {sales.map((row) => (
              <SalesCurrencyRow key={row.currency} row={row} />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

const SalesCurrencyRow: React.FC<{ row: PlatformSalesRow }> = ({ row }) => {
  const { t } = useTranslation();
  const figures: Array<[string, string, string]> = [
    ['admin.performance.platform.gmv', 'GMV', money(row.gmv, row.currency)],
    [
      'admin.performance.platform.collected',
      'Collected',
      money(row.collected, row.currency),
    ],
    [
      'admin.performance.platform.averageOrder',
      'Avg order',
      money(row.averageOrderValue, row.currency),
    ],
  ];
  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        {row.currency}
      </Typography>
      <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
        {figures.map(([key, fallback, value]) => (
          <Box key={key} sx={{ minWidth: 96 }}>
            <Typography variant="caption" color="text.secondary">
              {t(key, fallback)}
            </Typography>
            <Typography variant="body1" fontWeight={700}>
              {value}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};
