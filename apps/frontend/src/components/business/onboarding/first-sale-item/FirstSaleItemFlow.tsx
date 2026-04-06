import {
  ArrowBack as BackIcon,
  ChevronLeft as ChevronLeftIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Container,
  LinearProgress,
  Paper,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../../../contexts/UserProfileContext';
import FirstSaleItemCreateStep, {
  type CreatedSaleItemSummary,
} from './FirstSaleItemCreateStep';
import FirstSaleItemLocationStep from './FirstSaleItemLocationStep';
import FirstSaleItemSuccessStep from './FirstSaleItemSuccessStep';
import FirstSaleItemUploadStep from './FirstSaleItemUploadStep';
import type { SaleItemFromImageIntent } from './saleItemFromImageIntent';

export type { SaleItemFromImageIntent } from './saleItemFromImageIntent';

export interface FirstSaleItemFlowProps {
  /** `first`: onboarding copy & exit to dashboard. `additional`: catalog copy & exit to items. */
  intent?: SaleItemFromImageIntent;
}

const FirstSaleItemFlow: React.FC<FirstSaleItemFlowProps> = ({
  intent = 'first',
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const isFirst = intent === 'first';
  const exitPath = isFirst ? '/dashboard' : '/business/items';
  const [step, setStep] = useState(0);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [item, setItem] = useState<CreatedSaleItemSummary | null>(null);

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
    t('business.onboarding.firstSale.steps.create', 'Product details'),
    t('business.onboarding.firstSale.steps.location', 'Location'),
    t('business.onboarding.firstSale.steps.done', 'Done'),
  ];
  const stepCount = labels.length;
  const progressPct = ((step + 1) / stepCount) * 100;

  return (
    <Container
      maxWidth="sm"
      disableGutters={isNarrow}
      sx={{
        py: { xs: 1.5, sm: 4 },
        px: { xs: 2, sm: 3 },
        pb: { xs: 'max(16px, env(safe-area-inset-bottom))', sm: 4 },
      }}
    >
      <Button
        startIcon={<BackIcon />}
        onClick={() => navigate(exitPath)}
        sx={{
          mb: { xs: 1.5, sm: 2 },
          minHeight: 44,
          px: { xs: 1, sm: 2 },
        }}
      >
        {isFirst
          ? t('business.onboarding.firstSale.back', 'Back')
          : t(
              'business.onboarding.firstSale.backToItems',
              'Back to items'
            )}
      </Button>
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
          ? t(
              'business.onboarding.firstSale.title',
              'Add your first product'
            )
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
          sx={{ fontWeight: 600, mb: 1.5, fontSize: { xs: '1rem', sm: '1.25rem' } }}
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
          aria-label={labels[step]}
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={stepCount}
        />
      </Box>
      {step > 0 && step < 3 && (
        <Button
          type="button"
          startIcon={<ChevronLeftIcon />}
          variant="outlined"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          fullWidth={isNarrow}
          sx={{ mb: { xs: 1.5, sm: 2 }, minHeight: 44 }}
        >
          {t(
            'business.onboarding.firstSale.previousStep',
            'Previous step'
          )}
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
        )}
        {step === 1 && (
          <FirstSaleItemCreateStep
            imageIds={imageIds}
            imagePreviewUrls={imagePreviewUrls}
            existingItem={item}
            onComplete={(s) => {
              setItem(s);
              setStep(2);
            }}
          />
        )}
        {step === 2 && item && (
          <FirstSaleItemLocationStep
            item={item}
            onComplete={() => setStep(3)}
          />
        )}
        {step === 3 && item && (
          <FirstSaleItemSuccessStep item={item} intent={intent} />
        )}
      </Paper>
    </Container>
  );
};

export default FirstSaleItemFlow;
