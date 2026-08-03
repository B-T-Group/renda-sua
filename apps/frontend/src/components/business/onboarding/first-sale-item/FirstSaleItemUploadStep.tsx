import {
  Close as CloseIcon,
  CloudUpload as CloudUploadIcon,
  ErrorOutline as ErrorOutlineIcon,
  WarningAmber as WarningAmberIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogContent,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../../../contexts/UserProfileContext';
import {
  SUPPORTED_IMAGE_ACCEPT,
  isSupportedImageFile,
} from '../../../../constants/supportedImageFormats';
import { useAiImageCleanup } from '../../../../hooks/useAiImageCleanup';
import { useImageValidation } from '../../../../hooks/useImageValidation';
import type { ImageValidationResult } from '../../../../types/imageValidation';
import type { SaleItemFromImageIntent } from './saleItemFromImageIntent';

const GUIDELINES_DISMISSED_KEY = 'upload_guidelines_dismissed';
const minPhotos = 1;

interface FirstSaleItemUploadStepProps {
  intent?: SaleItemFromImageIntent;
  /** Restore previously selected files when returning from a later step. */
  initialFiles?: File[];
  onComplete: (
    imageIds: string[],
    files: File[],
    asyncCleanupRequested?: boolean
  ) => void;
}

const FirstSaleItemUploadStep: React.FC<FirstSaleItemUploadStepProps> = ({
  intent = 'first',
  initialFiles = [],
  onComplete,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { profile, updateBusinessAiTokens } = useUserProfileContext();
  const { validateFiles, validating } = useImageValidation();
  const { getPreference, setPreference } = useAiImageCleanup();

  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>(() => initialFiles);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [validationResults, setValidationResults] = useState<ImageValidationResult[]>([]);
  const [autoEnhanceEnabled, setAutoEnhanceEnabled] = useState(true);
  const [preferenceLoading, setPreferenceLoading] = useState(false);
  const [preferenceSaving, setPreferenceSaving] = useState(false);
  const [guidelinesOpen, setGuidelinesOpen] = useState(
    () => sessionStorage.getItem(GUIDELINES_DISMISSED_KEY) !== '1'
  );

  const aiTokensRemaining = profile?.business?.ai_tokens ?? 0;
  const cleanupEnabled = aiTokensRemaining > 0;
  const tokenCost = files.length;
  const canAfford = aiTokensRemaining >= tokenCost;

  useEffect(() => {
    if (!cleanupEnabled) return;
    let cancelled = false;
    setPreferenceLoading(true);
    void getPreference()
      .then((pref) => {
        if (cancelled) return;
        setAutoEnhanceEnabled(pref.auto_enhance_enabled);
        if (typeof pref.ai_tokens === 'number') {
          updateBusinessAiTokens(pref.ai_tokens);
        }
      })
      .finally(() => {
        if (!cancelled) setPreferenceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cleanupEnabled, getPreference, updateBusinessAiTokens]);

  const objectUrls = useMemo(
    () => files.map((f) => URL.createObjectURL(f)),
    [files]
  );

  useEffect(() => {
    return () => objectUrls.forEach((u) => URL.revokeObjectURL(u));
  }, [objectUrls]);

  const dismissGuidelines = () => {
    sessionStorage.setItem(GUIDELINES_DISMISSED_KEY, '1');
    setGuidelinesOpen(false);
  };

  const pickFiles = () => inputRef.current?.click();

  const addFiles = useCallback((next: File[]) => {
    if (!next.length) return;
    const valid = next.filter((file) => {
      if (isSupportedImageFile(file)) return true;
      enqueueSnackbar(
        t(
          'business.images.upload.unsupportedFormat',
          'Unsupported image format for {{file}}. Please use JPEG, PNG, or WebP.',
          { file: file.name }
        ),
        { variant: 'error' }
      );
      return false;
    });
    if (!valid.length) return;
    setFiles((prev) => [...prev, ...valid]);
  }, [enqueueSnackbar, t]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = '';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );
    addFiles(dropped);
  };

  const removeAt = (i: number) => {
    setPreviewIndex((prev) => {
      if (prev === null) return null;
      if (prev === i) return null;
      if (prev > i) return prev - 1;
      return prev;
    });
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setValidationResults((prev) => prev.filter((_, idx) => idx !== i));
  };

  const setAsMainAt = (i: number) => {
    if (i <= 0 || i >= files.length) return;
    setFiles((prev) => {
      const next = [...prev];
      const [picked] = next.splice(i, 1);
      next.unshift(picked);
      return next;
    });
    setPreviewIndex(null);
  };

  const finishWithLocalFiles = (asyncCleanupRequested: boolean) => {
    onComplete([], files, asyncCleanupRequested);
  };

  const handlePreferenceToggle = async (enabled: boolean) => {
    setAutoEnhanceEnabled(enabled);
    setPreferenceSaving(true);
    try {
      await setPreference(enabled);
    } catch (e: any) {
      setAutoEnhanceEnabled(!enabled);
      enqueueSnackbar(
        e?.message ||
          t(
            'business.aiImageCleanup.preferenceFailed',
            'Could not update auto-enhance preference'
          ),
        { variant: 'error' }
      );
    } finally {
      setPreferenceSaving(false);
    }
  };

  const handleContinue = async () => {
    if (files.length < minPhotos) return;
    if (cleanupEnabled && (preferenceLoading || preferenceSaving)) return;
    setBusy(true);
    try {
      const validation = await validateFiles(files);
      setValidationResults(validation.results);
      if (!validation.passed) {
        enqueueSnackbar(
          t('business.images.validation.blocked', 'Fix the issues below before uploading.'),
          { variant: 'error' }
        );
        return;
      }
      finishWithLocalFiles(cleanupEnabled && autoEnhanceEnabled && canAfford);
    } catch (e: any) {
      enqueueSnackbar(
        e?.message || t('business.onboarding.firstSale.upload.error', 'Failed to upload images'),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack
      spacing={{ xs: 2.5, sm: 2 }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontSize: { xs: '0.95rem', sm: '1rem' }, lineHeight: 1.5 }}
      >
        {t(
          intent === 'first'
            ? 'business.onboarding.firstSale.upload.hint'
            : 'business.onboarding.firstSale.upload.hintAdditional',
          'Add one or more photos. The main photo is used to create the listing; you can change which image is main before continuing. Extra photos attach to the same item.'
        )}
      </Typography>

      {cleanupEnabled ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {t(
                  'business.aiImageCleanup.autoEnhanceLabel',
                  'Auto-enhance photos with AI'
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'business.aiImageCleanup.autoEnhanceHint',
                  'Uses 1 AI token per photo. You have {{balance}}.',
                  { balance: aiTokensRemaining }
                )}
              </Typography>
              {!canAfford && files.length > 0 ? (
                <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
                  {t(
                    'business.images.asyncCleanup.insufficientTokens',
                    'Not enough tokens for all photos.'
                  )}
                </Typography>
              ) : null}
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={autoEnhanceEnabled}
                  disabled={preferenceLoading || preferenceSaving || busy}
                  onChange={(_, checked) => void handlePreferenceToggle(checked)}
                />
              }
              label={
                autoEnhanceEnabled
                  ? t('business.aiImageCleanup.autoEnhanceOn', 'On')
                  : t('business.aiImageCleanup.autoEnhanceOff', 'Off')
              }
              sx={{ m: 0 }}
            />
          </Stack>
          {!canAfford ? (
            <Button
              size="small"
              sx={{ mt: 1, textTransform: 'none' }}
              onClick={() => navigate('/business/ai-tokens')}
            >
              {t('business.images.asyncCleanup.buyTokens', 'Buy AI tokens')}
            </Button>
          ) : null}
        </Paper>
      ) : null}

      <Collapse in={guidelinesOpen}>
        <Alert
          severity="info"
          action={
            <Button
              size="small"
              color="inherit"
              onClick={dismissGuidelines}
              sx={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}
            >
              {t('business.images.guidelines.dismiss', 'Got it, hide')}
            </Button>
          }
        >
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            {t('business.images.validation.guidelines.intro', 'For the best listing experience, we recommend:')}
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            <li>{t('business.images.validation.guidelines.resolution', 'At least 800×800 pixels. Sharp, well-lit photos work best.')}</li>
            <li>{t('business.images.validation.guidelines.background', 'Clean background, good lighting.')}</li>
            <li>{t('business.images.validation.guidelines.fileSize', 'File size under 10 MB.')}</li>
            <li>{t('business.images.validation.guidelines.minPhotos', 'At least {{count}} photos are required.', { count: minPhotos })}</li>
          </Box>
        </Alert>
      </Collapse>

      <input
        ref={inputRef}
        type="file"
        accept={SUPPORTED_IMAGE_ACCEPT}
        multiple
        hidden
        onChange={onFileChange}
      />

      {files.length === 0 ? (
        <Paper
          variant="outlined"
          onClick={pickFiles}
          sx={{
            border: 2,
            borderStyle: 'dashed',
            borderColor: isDragging ? 'primary.main' : 'divider',
            borderRadius: 3,
            p: { xs: 4, sm: 6 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5,
            cursor: 'pointer',
            bgcolor: isDragging ? 'primary.50' : 'background.paper',
            transition: 'all 0.15s',
            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
          }}
          aria-label={t('business.onboarding.firstSale.upload.dropZoneLabel', 'Upload images')}
        >
          <CloudUploadIcon sx={{ fontSize: 48, color: isDragging ? 'primary.main' : 'text.secondary' }} />
          <Typography variant="body1" fontWeight={500} color="text.primary">
            {t('business.onboarding.firstSale.upload.dragHere', 'Drag photos here or click to browse')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('business.onboarding.firstSale.upload.formats', 'JPEG, PNG, WEBP · up to 10 MB')}
          </Typography>
        </Paper>
      ) : (
        <>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.5,
              justifyContent: { xs: 'center', sm: 'flex-start' },
            }}
          >
            {files.map((f, i) => {
              const hasError = validationResults[i]?.errors?.length > 0;
              const hasWarning = !hasError && validationResults[i]?.warnings?.length > 0;
              return (
                <Box
                  key={`${f.name}-${f.size}-${f.lastModified}-${i}`}
                  sx={{
                    position: 'relative',
                    width: { xs: 'calc(50% - 6px)', sm: 112 },
                    maxWidth: { xs: 200, sm: 112 },
                    flexShrink: 0,
                  }}
                >
                  <Box
                    component="button"
                    type="button"
                    onClick={() => setPreviewIndex(i)}
                    sx={{
                      p: 0,
                      border: 2,
                      borderColor: hasError ? 'error.main' : hasWarning ? 'warning.main' : 'divider',
                      borderRadius: 2,
                      overflow: 'hidden',
                      bgcolor: 'grey.50',
                      cursor: 'pointer',
                      display: 'block',
                      width: '100%',
                      '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
                    }}
                    aria-label={t('business.onboarding.firstSale.upload.previewPhoto', 'Preview {{name}}', { name: f.name })}
                  >
                    <Box
                      component="img"
                      src={objectUrls[i]}
                      alt={t('business.onboarding.firstSale.upload.photoAlt', 'Product photo {{n}}', { n: i + 1 })}
                      sx={{ width: '100%', height: { xs: 120, sm: 112 }, objectFit: 'cover', display: 'block' }}
                    />
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); removeAt(i); }}
                    sx={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      bgcolor: 'background.paper',
                      boxShadow: 1,
                      '&:hover': { bgcolor: 'background.paper' },
                    }}
                    aria-label={t('common.remove', 'Remove')}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                  {hasError && (
                    <Tooltip title={validationResults[i].errors[0]?.message ?? t('common.error', 'Error')}>
                      <ErrorOutlineIcon
                        fontSize="small"
                        color="error"
                        sx={{ position: 'absolute', bottom: 26, left: 4, bgcolor: 'background.paper', borderRadius: '50%' }}
                      />
                    </Tooltip>
                  )}
                  {hasWarning && (
                    <Tooltip title={validationResults[i].warnings[0]?.message ?? t('common.warning', 'Warning')}>
                      <WarningAmberIcon
                        fontSize="small"
                        color="warning"
                        sx={{ position: 'absolute', bottom: 26, left: 4, bgcolor: 'background.paper', borderRadius: '50%' }}
                      />
                    </Tooltip>
                  )}
                  {i === 0 ? (
                    <Chip
                      size="small"
                      color="primary"
                      label={t('business.onboarding.firstSale.upload.mainPhoto', 'Main')}
                      sx={{ position: 'absolute', top: 2, left: 2, height: 22, fontSize: '0.7rem', fontWeight: 600 }}
                    />
                  ) : null}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={f.name}
                  >
                    {f.name}
                  </Typography>
                  {files.length > 1 && i > 0 ? (
                    <Button
                      type="button"
                      size="small"
                      variant="text"
                      onClick={(e) => { e.stopPropagation(); setAsMainAt(i); }}
                      sx={{ mt: 0.25, minHeight: 0, py: 0.25, px: 0, fontSize: '0.75rem', textTransform: 'none' }}
                    >
                      {t('business.onboarding.firstSale.upload.setAsMain', 'Set as main')}
                    </Button>
                  ) : null}
                </Box>
              );
            })}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t(
              'business.onboarding.firstSale.upload.previewHint',
              'The main listing photo is on the left. Tap a photo to view it full size.'
            )}
          </Typography>
        </>
      )}

      <Dialog
        open={previewIndex !== null && previewIndex < objectUrls.length}
        onClose={() => setPreviewIndex(null)}
        maxWidth="lg"
        fullWidth
        aria-labelledby="first-sale-image-preview-title"
      >
        <DialogContent sx={{ p: 1, position: 'relative', bgcolor: 'grey.900' }}>
          <IconButton
            onClick={() => setPreviewIndex(null)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: 'common.white',
              bgcolor: 'rgba(0,0,0,0.5)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
            }}
            aria-label={t('common.close', 'Close')}
          >
            <CloseIcon />
          </IconButton>
          {previewIndex !== null && objectUrls[previewIndex] && (
            <Box
              component="img"
              src={objectUrls[previewIndex]}
              alt={t('business.onboarding.firstSale.upload.photoAlt', 'Product photo {{n}}', { n: (previewIndex ?? 0) + 1 })}
              sx={{ width: '100%', maxHeight: '85vh', objectFit: 'contain', display: 'block', mx: 'auto' }}
            />
          )}
          {previewIndex !== null && files[previewIndex] && (
            <Typography
              id="first-sale-image-preview-title"
              variant="body2"
              sx={{ color: 'grey.300', mt: 1, px: 1, textAlign: 'center' }}
            >
              {files[previewIndex].name}
            </Typography>
          )}
        </DialogContent>
      </Dialog>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ '& .MuiButton-root': { minHeight: 48, width: { xs: '100%', sm: 'auto' } } }}
      >
        <Button
          variant="outlined"
          startIcon={<CloudUploadIcon />}
          onClick={pickFiles}
          disabled={busy}
          fullWidth={isNarrow}
        >
          {t('business.onboarding.firstSale.upload.chooseFiles', 'Choose images')}
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleContinue()}
          disabled={
            busy ||
            validating ||
            files.length < minPhotos ||
            (cleanupEnabled && (preferenceLoading || preferenceSaving))
          }
          fullWidth={isNarrow}
          startIcon={
            busy || validating ? (
              <CircularProgress color="inherit" size={18} />
            ) : undefined
          }
        >
          {validating
            ? t('business.images.validation.validating', 'Checking image quality…')
            : busy
              ? t('common.loading', 'Loading…')
              : t('business.onboarding.firstSale.upload.continue', 'Continue')}
        </Button>
      </Stack>
    </Stack>
  );
};

export default FirstSaleItemUploadStep;
