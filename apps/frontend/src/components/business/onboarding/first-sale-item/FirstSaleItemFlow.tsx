import {
  ArrowBack as BackIcon,
  ChevronLeft as ChevronLeftIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Paper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../../../contexts/UserProfileContext';
import type { CreatedSaleItemSummary } from './FirstSaleItemCreateStep';
import FirstSaleItemReviewStep from './FirstSaleItemReviewStep';
import FirstSaleItemSuccessStep from './FirstSaleItemSuccessStep';
import FirstSaleItemUploadStep from './FirstSaleItemUploadStep';
import type { SaleItemFromImageIntent } from './saleItemFromImageIntent';

export type { SaleItemFromImageIntent } from './saleItemFromImageIntent';

export interface FirstSaleItemFlowProps {
  intent?: SaleItemFromImageIntent;
  /** Prefer this location on the stock step when present in the list. */
  initialLocationId?: string;
}

const FirstSaleItemFlow: React.FC<FirstSaleItemFlowProps> = ({
  intent = 'first',
  initialLocationId,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const isFirst = intent === 'first';
  const itemsPath = initialLocationId
    ? `/business/items?location=${encodeURIComponent(initialLocationId)}`
    : '/business/items';
  const exitPath = isFirst ? '/dashboard' : itemsPath;
  const [step, setStep] = useState(0);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [merchantHint, setMerchantHint] = useState('');
  const [item, setItem] = useState<CreatedSaleItemSummary | null>(null);
  const [locationName, setLocationName] = useState<string | undefined>(
    undefined
  );
  const [savedAsDraft, setSavedAsDraft] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);

  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [imagePreviewUrls]);

  if (!profile?.business) {
    return <Navigate to="/dashboard" replace />;
  }

  const labels = [
    t('business.onboarding.firstSale.steps.upload', 'Photos'),
    t('business.onboarding.firstSale.steps.review', 'Review'),
    t('business.onboarding.firstSale.steps.done', 'Done'),
  ];
  const stepCount = labels.length;
  const progressPct = ((step + 1) / stepCount) * 100;

  const handleBackClick = () => {
    if (step === 0) {
      navigate(exitPath);
    } else {
      setExitDialogOpen(true);
    }
  };

  return (
    <Container
      maxWidth="md"
      disableGutters={isNarrow}
      sx={{
        py: { xs: 1.5, sm: 4 },
        px: { xs: 2, sm: 3 },
        pb: { xs: 'max(16px, env(safe-area-inset-bottom))', sm: 4 },
      }}
    >
      {step < 2 && (
        <Button
          startIcon={<BackIcon />}
          onClick={handleBackClick}
          sx={{ mb: { xs: 1.5, sm: 2 }, minHeight: 44, px: { xs: 1, sm: 2 } }}
        >
          {step === 0
            ? isFirst
              ? t('business.onboarding.firstSale.back', 'Back')
              : t('business.onboarding.firstSale.backToItems', 'Back to items')
            : t('business.onboarding.firstSale.exitFlow', 'Exit')}
        </Button>
      )}

      <Typography
        variant="h5"
        component="h1"
        gutterBottom
        sx={{
          fontWeight: 600,
          fontSize: { xs: '1.35rem', sm: '2rem' },
          lineHeight: 1.3,
          mb: 2,
        }}
      >
        {isFirst
          ? t('business.onboarding.firstSale.title', 'Add your first product')
          : t(
              'business.onboarding.firstSale.titleAdditional',
              'Add a product from photos'
            )}
      </Typography>

      <Box sx={{ mb: { xs: 2, sm: 3 } }}>
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          sx={{ mb: 0.5, letterSpacing: 0.3 }}
        >
          {t(
            'business.onboarding.firstSale.stepProgress',
            'Step {{current}} of {{total}}',
            { current: step + 1, total: stepCount }
          )}
        </Typography>
        <Typography
          variant="h6"
          component="h2"
          sx={{
            fontWeight: 600,
            mb: 1.5,
            fontSize: { xs: '1rem', sm: '1.25rem' },
          }}
        >
          {labels[step]}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progressPct}
          sx={{
            height: 8,
            borderRadius: 1,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': { borderRadius: 1 },
          }}
          aria-label={t(
            'business.onboarding.firstSale.stepProgressLabel',
            'Step {{current}} of {{total}}: {{label}}',
            {
              current: step + 1,
              total: stepCount,
              label: labels[step],
            }
          )}
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={stepCount}
        />
      </Box>

      {step > 0 && step < 2 && (
        <Button
          type="button"
          startIcon={<ChevronLeftIcon />}
          variant="outlined"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          fullWidth={isNarrow}
          sx={{ mb: { xs: 1.5, sm: 2 }, minHeight: 44 }}
        >
          {t('business.onboarding.firstSale.previousStep', 'Previous step')}
        </Button>
      )}

      <Paper
        elevation={isNarrow ? 0 : 1}
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: { xs: 2, sm: 1 },
          border: { xs: 1, sm: 0 },
          borderColor: { xs: 'divider', sm: 'transparent' },
        }}
      >
        {step === 0 && (
          <>
            <TextField
              fullWidth
              size="small"
              sx={{ mb: 2 }}
              label={t(
                'business.onboarding.firstSale.hint.prompt',
                'What did you photograph? (optional)'
              )}
              placeholder={t(
                'business.onboarding.firstSale.hint.example1',
                'Coca-Cola Zero 1.5L'
              )}
              value={merchantHint}
              onChange={(e) => setMerchantHint(e.target.value)}
              helperText={t(
                'business.onboarding.firstSale.hint.helpTitle',
                'Help the AI (optional)'
              )}
            />
            <FirstSaleItemUploadStep
              intent={intent}
              onComplete={(ids, uploadedFiles) => {
                setImagePreviewUrls((prev) => {
                  prev.forEach((u) => URL.revokeObjectURL(u));
                  return uploadedFiles.map((f) => URL.createObjectURL(f));
                });
                setImageIds((prev) => {
                  if (JSON.stringify(prev) !== JSON.stringify(ids)) {
                    setItem(null);
                  }
                  return ids;
                });
                setStep(1);
              }}
            />
          </>
        )}
        {step === 1 && (
          <FirstSaleItemReviewStep
            imageIds={imageIds}
            imagePreviewUrls={imagePreviewUrls}
            merchantHint={merchantHint}
            initialLocationId={initialLocationId}
            onComplete={(summary, asDraft, locName) => {
              setItem(summary);
              setSavedAsDraft(asDraft);
              setLocationName(locName);
              setStep(2);
            }}
          />
        )}
        {step === 2 && item && (
          <FirstSaleItemSuccessStep
            item={item}
            intent={intent}
            locationName={locationName}
            savedAsDraft={savedAsDraft}
            initialLocationId={initialLocationId}
            photoCount={imageIds.length}
          />
        )}
      </Paper>

      <Dialog
        open={exitDialogOpen}
        onClose={() => setExitDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {t('business.onboarding.firstSale.exitTitle', 'Leave this flow?')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t(
              'business.onboarding.firstSale.exitBody',
              'Your draft is saved on the server when photos upload. You can resume from your items list.',
              { step: step + 1 }
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExitDialogOpen(false)}>
            {t('business.onboarding.firstSale.exitStay', 'Stay')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setExitDialogOpen(false);
              navigate(exitPath);
            }}
          >
            {t('business.onboarding.firstSale.exitLeave', 'Leave')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default FirstSaleItemFlow;
