import { Payments } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WeeklyPayoutPreview } from '../../hooks/useAdminPerformance';
import { ReferralSaturdayPayoutIllustration } from '../illustrations/ReferralSaturdayPayoutIllustration';
import {
  AdminPayoutPreviewTable,
  formatPayoutMoney,
} from './AdminPayoutPreviewTable';

interface AdminPayoutPreviewDialogProps {
  countryCode: string;
  fetchPreview: (countryCode: string) => Promise<WeeklyPayoutPreview | null>;
}

export const AdminPayoutPreviewDialog: React.FC<
  AdminPayoutPreviewDialogProps
> = ({ countryCode, fetchPreview }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<WeeklyPayoutPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleOpen = async () => {
    setOpen(true);
    setLoading(true);
    setLoadError(null);
    setPreview(null);
    const data = await fetchPreview(countryCode);
    setPreview(data);
    if (!data) {
      setLoadError(
        t(
          'admin.performance.payoutPreview.loadError',
          'Could not load the payout preview.'
        )
      );
    }
    setLoading(false);
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<Payments />}
        onClick={() => void handleOpen()}
      >
        {t('admin.performance.payoutPreview.button', 'Preview Saturday payouts')}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <ReferralSaturdayPayoutIllustration size={72} />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {t(
                  'admin.performance.payoutPreview.title',
                  'Upcoming referral payouts'
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'admin.performance.payoutPreview.subtitle',
                  'Dry run of the Saturday job: one line per referred business, including pyramid shares. Nothing is credited.'
                )}
              </Typography>
            </Box>
          </Stack>
          <IconButton
            onClick={() => setOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
            aria-label={t('common.close', 'Close')}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {!loading && loadError && (
            <Alert severity="error">{loadError}</Alert>
          )}
          {!loading && preview && <PreviewBody preview={preview} />}
        </DialogContent>
      </Dialog>
    </>
  );
};

const PreviewBody: React.FC<{ preview: WeeklyPayoutPreview }> = ({
  preview,
}) => {
  const { t } = useTranslation();
  return (
    <Stack spacing={2}>
      {!preview.enabled && (
        <Alert severity="warning">
          {t(
            'admin.performance.payoutPreview.disabled',
            'Payouts are currently disabled. The Saturday job will skip these until the flag is on.'
          )}
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary">
        {t(
          'admin.performance.payoutPreview.summary',
          '{{payable}} payable, {{skipped}} skipped. Pyramid {{g1}}% / {{g2}}% / {{g3}}%. Min {{min}} approved items after {{cutoff}}.',
          {
            payable: preview.payableCount,
            skipped: preview.skippedCount,
            g1: preview.percents.gen1,
            g2: preview.percents.gen2,
            g3: preview.percents.gen3,
            min: preview.minItems,
            cutoff: preview.cutoffDate,
          }
        )}
      </Typography>
      {preview.totalsByCurrency.map((total) => (
        <Chip
          key={total.currency}
          label={t(
            'admin.performance.payoutPreview.totalChip',
            '{{count}} businesses · {{amount}}',
            {
              count: total.count,
              amount: formatPayoutMoney(total.gross, total.currency),
            }
          )}
        />
      ))}
      {preview.rows.length === 0 ? (
        <Typography color="text.secondary">
          {t(
            'admin.performance.payoutPreview.empty',
            'No unpaid eligible businesses for this market.'
          )}
        </Typography>
      ) : (
        <AdminPayoutPreviewTable rows={preview.rows} />
      )}
    </Stack>
  );
};
