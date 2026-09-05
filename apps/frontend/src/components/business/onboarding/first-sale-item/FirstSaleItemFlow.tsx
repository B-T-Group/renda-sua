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
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../../../contexts/UserProfileContext';
import { useBusinessLockedCurrency } from '../../../../hooks/useBusinessLockedCurrency';
import type { ImageItemSuggestions } from '../../../../hooks/useImageItemSuggestions';
import type { CreatedSaleItemSummary } from './FirstSaleItemCreateStep';
import FirstSaleItemDescriptionStep from './FirstSaleItemDescriptionStep';
import FirstSaleItemProcessingStep from './FirstSaleItemProcessingStep';
import FirstSaleItemPublishStep from './FirstSaleItemPublishStep';
import FirstSaleItemReviewStep, {
  type ReviewFormValues,
} from './FirstSaleItemReviewStep';
import FirstSaleItemSuccessStep from './FirstSaleItemSuccessStep';
import FirstSaleItemUploadStep from './FirstSaleItemUploadStep';
import type { SaleItemFromImageIntent } from './saleItemFromImageIntent';

export type { SaleItemFromImageIntent } from './saleItemFromImageIntent';

const STEP = {
  photos: 0,
  description: 1,
  processing: 2,
  review: 3,
  publish: 4,
  done: 5,
} as const;

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
  const { lockedCurrency } = useBusinessLockedCurrency(profile?.business?.id);
  const isFirst = intent === 'first';
  const itemsPath = initialLocationId
    ? `/business/items?location=${encodeURIComponent(initialLocationId)}`
    : '/business/items';
  const exitPath = isFirst ? '/dashboard' : itemsPath;

  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [asyncCleanupRequested, setAsyncCleanupRequested] = useState(false);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [merchantHint, setMerchantHint] = useState('');
  const [merchantPrice, setMerchantPrice] = useState('');
  const [isFoodItem, setIsFoodItem] = useState(false);
  const [preparationMinutes, setPreparationMinutes] = useState('');
  const [itemId, setItemId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ImageItemSuggestions | null>(
    null
  );
  const [reviewForm, setReviewForm] = useState<ReviewFormValues | null>(null);
  const [processedCleanup, setProcessedCleanup] = useState(false);
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
    t('business.onboarding.firstSale.steps.description', 'Description'),
    t('business.onboarding.firstSale.steps.processing', 'Processing'),
    t('business.onboarding.firstSale.steps.review', 'Review'),
    t('business.onboarding.firstSale.steps.publish', 'Publish'),
    t('business.onboarding.firstSale.steps.done', 'Done'),
  ];
  const stepCount = labels.length;
  const progressPct = ((step + 1) / stepCount) * 100;
  const showChrome = step < STEP.done;
  const canGoPrevious =
    step === STEP.description || step === STEP.review || step === STEP.publish;

  const filesMatch = (a: File[], b: File[]) =>
    a.length === b.length &&
    a.every(
      (f, i) => f.name === b[i]?.name && f.size === b[i]?.size && f.lastModified === b[i]?.lastModified
    );

  const handlePrevious = () => {
    if (step === STEP.description) {
      setStep(STEP.photos);
      return;
    }
    if (step === STEP.review) {
      // Skip processing so we do not re-queue cleanup / re-analyze.
      setStep(STEP.description);
      return;
    }
    if (step === STEP.publish) {
      setStep(STEP.review);
    }
  };

  const handleBackClick = () => {
    if (step === STEP.photos) {
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
      {showChrome && (
        <Button
          startIcon={<BackIcon />}
          onClick={handleBackClick}
          sx={{ mb: { xs: 1.5, sm: 2 }, minHeight: 44, px: { xs: 1, sm: 2 } }}
        >
          {step === STEP.photos
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

      {showChrome && (
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
      )}

      {canGoPrevious && (
        <Button
          type="button"
          startIcon={<ChevronLeftIcon />}
          variant="outlined"
          onClick={handlePrevious}
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
        {step === STEP.photos && (
          <FirstSaleItemUploadStep
            intent={intent}
            initialFiles={files}
            onComplete={(_ids, uploadedFiles, cleanupRequested) => {
              const sameFiles = filesMatch(files, uploadedFiles);
              setImagePreviewUrls((prev) => {
                prev.forEach((u) => URL.revokeObjectURL(u));
                return uploadedFiles.map((f) => URL.createObjectURL(f));
              });
              setFiles(uploadedFiles);
              setAsyncCleanupRequested(!!cleanupRequested);
              if (!sameFiles) {
                setImageIds([]);
                setItemId(null);
                setSuggestions(null);
                setReviewForm(null);
                setProcessedCleanup(false);
              }
              setStep(STEP.description);
            }}
          />
        )}
        {step === STEP.description && (
          <FirstSaleItemDescriptionStep
            hint={merchantHint}
            price={merchantPrice}
            currency={lockedCurrency || 'XAF'}
            isFoodItem={isFoodItem}
            preparationMinutes={preparationMinutes}
            onChange={setMerchantHint}
            onPriceChange={setMerchantPrice}
            onFoodItemChange={setIsFoodItem}
            onPreparationMinutesChange={setPreparationMinutes}
            onContinue={() => {
              if (!merchantHint.trim()) return;
              const n = Number.parseFloat(merchantPrice.replace(',', '.'));
              if (Number.isNaN(n) || n <= 0) return;
              setReviewForm(null);
              setStep(STEP.processing);
            }}
          />
        )}
        {step === STEP.processing && (
          <FirstSaleItemProcessingStep
            files={files}
            merchantHint={merchantHint}
            isFoodItem={isFoodItem}
            asyncCleanupRequested={asyncCleanupRequested}
            initialImageIds={imageIds}
            initialItemId={itemId}
            initialSuggestions={suggestions}
            initialCleanupQueued={processedCleanup}
            onContinue={(payload) => {
              setImageIds(payload.imageIds);
              setItemId(payload.itemId);
              setSuggestions(payload.suggestions);
              setProcessedCleanup(payload.cleanupQueued);
              setReviewForm(null);
              setStep(STEP.review);
            }}
          />
        )}
        {step === STEP.review && itemId && (
          <FirstSaleItemReviewStep
            imagePreviewUrls={imagePreviewUrls}
            merchantHint={merchantHint}
            merchantPrice={merchantPrice}
            isFoodItem={isFoodItem}
            merchantPreparationMinutes={preparationMinutes}
            suggestions={suggestions}
            initialValues={reviewForm}
            onContinue={(values) => {
              setReviewForm(values);
              setStep(STEP.publish);
            }}
          />
        )}
        {step === STEP.publish && itemId && reviewForm && (
          <FirstSaleItemPublishStep
            itemId={itemId}
            imageIds={imageIds}
            form={reviewForm}
            merchantHint={merchantHint}
            qualityScore={suggestions?.listingQuality?.score}
            initialLocationId={initialLocationId}
            onComplete={(summary, asDraft, locName) => {
              setItem(summary);
              setSavedAsDraft(asDraft);
              setLocationName(locName);
              setStep(STEP.done);
            }}
          />
        )}
        {step === STEP.done && item && (
          <FirstSaleItemSuccessStep
            item={item}
            intent={intent}
            locationName={locationName}
            savedAsDraft={savedAsDraft}
            initialLocationId={initialLocationId}
            photoCount={imageIds.length || files.length}
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
              'Photos stay on this device until processing finishes. Leave anyway?',
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
