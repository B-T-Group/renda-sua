import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Skeleton,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { CurrencyExchange } from '@mui/icons-material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RefundRequestDetail } from '../../hooks/useOrderRefunds';

const REFUND_STATUSES = new Set([
  'refund_requested',
  'refund_approved_full',
  'refund_approved_partial',
  'refund_approved_replace',
  'refund_rejected',
  'refund_processing',
  'refund_failed',
  'refunded',
]);

export function isRefundOrderStatus(status: string): boolean {
  return REFUND_STATUSES.has(status);
}

function destinationLabel(
  destination: string | null | undefined,
  t: (k: string, d: string) => string
): string {
  if (destination === 'stripe') {
    return t('orders.refunds.destination.card', 'Original payment card (5–10 business days)');
  }
  if (destination === 'wallet') {
    return t('orders.refunds.destination.wallet', 'RendaSua wallet (usually instant)');
  }
  return t('orders.refunds.destination.manual', 'Manual refund');
}

function getActiveStep(status: string, hasFailedPayment: boolean): number {
  if (status === 'refund_requested') return 0;
  if (
    status === 'refund_approved_full' ||
    status === 'refund_approved_partial' ||
    status === 'refund_approved_replace'
  ) {
    return 1;
  }
  if (status === 'refund_processing') return 2;
  if (status === 'refunded') return 3;
  if (status === 'refund_failed' || hasFailedPayment) return 2;
  if (status === 'refund_rejected') return 3;
  return 0;
}

export interface RefundProgressCardProps {
  orderStatus: string;
  detail: RefundRequestDetail | null;
  loading?: boolean;
}

export const RefundProgressCard: React.FC<RefundProgressCardProps> = ({
  orderStatus,
  detail,
  loading,
}) => {
  const { t } = useTranslation();
  const hasFailedPayment = detail?.payments?.some((p) => p.status === 'failed') ?? false;
  const activeStep = getActiveStep(orderStatus, hasFailedPayment);
  const isRejected = orderStatus === 'refund_rejected';
  const isFailed = orderStatus === 'refund_failed' || hasFailedPayment;

  if (loading) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Skeleton height={120} />
        </CardContent>
      </Card>
    );
  }

  const steps = [
    t('orders.refundProgress.stepRequested', 'Refund requested'),
    t('orders.refundProgress.stepReview', 'Business review'),
    t('orders.refundProgress.stepProcessing', 'Refund processing'),
    isRejected
      ? t('orders.refundProgress.stepDeclined', 'Request declined')
      : isFailed
        ? t('orders.refundProgress.stepFailed', 'Refund failed')
        : t('orders.refundProgress.stepRefunded', 'Refunded'),
  ];

  return (
    <Card sx={{ mb: 3, overflow: 'visible' }}>
      <CardContent sx={{ p: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
          <CurrencyExchange color="primary" />
          <Typography variant="h6" fontWeight="bold">
            {t('orders.refundProgress.title', 'Refund status')}
          </Typography>
          {detail?.destination ? (
            <Chip
              size="small"
              label={destinationLabel(detail.destination, t)}
              color={detail.destination === 'stripe' ? 'info' : 'default'}
            />
          ) : null}
        </Box>

        {detail?.rejection_reason ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {String(detail.rejection_reason)}
          </Alert>
        ) : null}

        {isFailed ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t(
              'orders.refunds.stripeFailed',
              'Card refund could not be completed. Our team has been notified and will retry or contact you.'
            )}
          </Alert>
        ) : null}

        <Stepper alternativeLabel activeStep={activeStep} sx={{ display: { xs: 'none', md: 'flex' }, mb: 2 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel error={isRejected || isFailed}>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={(activeStep / 3) * 100}
            color={isRejected || isFailed ? 'error' : 'primary'}
            sx={{ height: 8, borderRadius: 1, mb: 1 }}
          />
          <Typography variant="body2" color="text.secondary">
            {steps[activeStep] ?? steps[0]}
          </Typography>
        </Box>

        {detail?.timeline && detail.timeline.length > 0 ? (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('orders.refundProgress.timeline', 'Timeline')}
            </Typography>
            {detail.timeline.map((ev) => (
              <Box key={ev.id} sx={{ py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" fontWeight={500}>
                  {t(`orders.refunds.events.${ev.event_type}`, ev.event_type)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(ev.created_at).toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : null}

        {detail?.evidence && detail.evidence.length > 0 ? (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('orders.refunds.evidence', 'Evidence')}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {detail.evidence.map((e) => (
                <Box
                  key={e.id}
                  component="a"
                  href={e.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ width: 72, height: 72, borderRadius: 1, overflow: 'hidden', border: 1, borderColor: 'divider' }}
                >
                  <Box
                    component="img"
                    src={e.file_url}
                    alt=""
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
};
