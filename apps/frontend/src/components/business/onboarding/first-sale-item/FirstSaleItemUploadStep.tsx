import {
  AutoAwesome as AutoAwesomeIcon,
  CheckCircle as CheckCircleIcon,
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
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../../../contexts/UserProfileContext';
import ImageCleanupPreviewDialog from '../../../dialogs/ImageCleanupPreviewDialog';
import { useBusinessImages } from '../../../../hooks/useBusinessImages';
import { useAws } from '../../../../hooks/useAws';
import { useImageValidation } from '../../../../hooks/useImageValidation';
import type { ImageValidationResult } from '../../../../types/imageValidation';
import { fileMimeType, fileToBase64 } from '../../../../utils/imageFileToBase64';
import { presignUploadLibraryImage } from '../onboardingPresignedUpload';
import type { SaleItemFromImageIntent } from './saleItemFromImageIntent';

const GUIDELINES_DISMISSED_KEY = 'upload_guidelines_dismissed';
const minPhotos = 2;

interface FirstSaleItemUploadStepProps {
  intent?: SaleItemFromImageIntent;
  onComplete: (imageIds: string[], files: File[]) => void;
}

const FirstSaleItemUploadStep: React.FC<FirstSaleItemUploadStepProps> = ({
  intent = 'first',
  onComplete,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const { profile, updateBusinessAiTokens } = useUserProfileContext();
  const { generateImageUploadUrl } = useAws();
  const { bulkCreateImages, submitting } = useBusinessImages();
  const {
    validateFiles,
    metadataFromResults,
    cleanupPreview,
    validating,
    cleanupLoading,
  } = useImageValidation();

  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [cleanedFlags, setCleanedFlags] = useState<boolean[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [validationResults, setValidationResults] = useState<ImageValidationResult[]>([]);
  const [cleanupIndex, setCleanupIndex] = useState<number | null>(null);
  const [cleanupB64, setCleanupB64] = useState<string | null>(null);
  const [showCleanupStep, setShowCleanupStep] = useState(false);
  const [guidelinesOpen, setGuidelinesOpen] = useState(
    () => sessionStorage.getItem(GUIDELINES_DISMISSED_KEY) !== '1'
  );

  const cleanupEnabled = (profile?.business?.ai_tokens ?? 0) > 0;
  const bucketName = process.env.REACT_APP_S3_BUCKET_NAME || 'rendasua-uploads';

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
    setFiles((prev) => [...prev, ...next]);
    setCleanedFlags((prev) => [...prev, ...next.map(() => false)]);
  }, []);

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
    setCleanedFlags((prev) => prev.filter((_, idx) => idx !== i));
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
    setCleanedFlags((prev) => {
      const next = [...prev];
      const [picked] = next.splice(i, 1);
      next.unshift(picked);
      return next;
    });
    setPreviewIndex(null);
  };

  const runCleanupForIndex = async (index: number) => {
    const file = files[index];
    if (!file) return;
    const result = validationResults[index];
    const issues = [...(result?.errors ?? []), ...(result?.warnings ?? [])];
    setCleanupIndex(index);
    setCleanupB64(null);
    try {
      const preview = await cleanupPreview({
        imageBase64: await fileToBase64(file),
        mimeType: fileMimeType(file),
        issues,
      });
      setCleanupB64(preview.b64_json);
      if (typeof preview.ai_tokens_remaining === 'number') {
        updateBusinessAiTokens(preview.ai_tokens_remaining);
      }
    } catch (e: any) {
      enqueueSnackbar(
        e?.message || t('business.images.cleanup.error', 'Failed to cleanup image'),
        { variant: 'error' }
      );
      setCleanupIndex(null);
    }
  };

  const acceptCleanup = async () => {
    if (cleanupIndex === null || !cleanupB64) return;
    const blob = await fetch(`data:image/png;base64,${cleanupB64}`).then((r) => r.blob());
    const cleaned = new File([blob], `cleaned-${files[cleanupIndex].name}.png`, {
      type: 'image/png',
    });
    setFiles((prev) => {
      const next = [...prev];
      next[cleanupIndex] = cleaned;
      return next;
    });
    setCleanedFlags((prev) => {
      const next = [...prev];
      next[cleanupIndex] = true;
      return next;
    });
    setCleanupIndex(null);
    setCleanupB64(null);
  };

  const handleContinue = async () => {
    const bid = profile?.business?.id;
    if (!bid || files.length < minPhotos) return;
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
      if (cleanupEnabled) {
        setShowCleanupStep(true);
        return;
      }
      await doUpload(bid, validation.results);
    } catch (e: any) {
      enqueueSnackbar(
        e?.message || t('business.onboarding.firstSale.upload.error', 'Failed to upload images'),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  const doUpload = async (bid: string, results: ImageValidationResult[]) => {
    const meta = metadataFromResults(results);
    const prefix = `businesses/${bid}/images`;
    const errMsg = t('business.onboarding.firstSale.upload.presignError', 'Failed to prepare image upload');
    const payloads = [];
    for (let i = 0; i < files.length; i++) {
      payloads.push({
        ...(await presignUploadLibraryImage(files[i], bucketName, prefix, generateImageUploadUrl, errMsg)),
        ...meta[i],
      });
    }
    const ids = await bulkCreateImages({ images: payloads }, { skipRefetch: true });
    if (!ids.length) {
      throw new Error(t('business.onboarding.firstSale.upload.noIds', 'Upload did not return image ids'));
    }
    enqueueSnackbar(
      t('business.onboarding.firstSale.upload.success', 'Images uploaded successfully'),
      { variant: 'success' }
    );
    onComplete(ids.map((r) => r.id), files);
  };

  const handleUploadAndContinue = async () => {
    const bid = profile?.business?.id;
    if (!bid) return;
    setBusy(true);
    try {
      await doUpload(bid, validationResults);
    } catch (e: any) {
      enqueueSnackbar(
        e?.message || t('business.onboarding.firstSale.upload.error', 'Failed to upload images'),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  if (showCleanupStep) {
    return (
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {t('business.images.cleanup.enhanceTitle', 'Enhance your photos')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(
              'business.images.cleanup.enhanceHint',
              'Optionally use AI to clean up each photo before publishing. You can skip any or all.'
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t(
              'business.images.cleanup.tokenCostWithBalance',
              'This uses 1 AI token. You have {{count}} left.',
              { count: profile?.business?.ai_tokens ?? 0 }
            )}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {files.map((f, i) => (
            <Box
              key={`${f.name}-${f.size}-${f.lastModified}-${i}`}
              sx={{ position: 'relative', width: { xs: 'calc(50% - 8px)', sm: 140 }, flexShrink: 0 }}
            >
              <Box
                component="img"
                src={objectUrls[i]}
                alt={t('business.onboarding.firstSale.upload.photoAlt', 'Product photo {{n}}', { n: i + 1 })}
                sx={{
                  width: '100%',
                  height: { xs: 130, sm: 140 },
                  objectFit: 'cover',
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  display: 'block',
                }}
              />
              {i === 0 && (
                <Chip
                  size="small"
                  color="primary"
                  label={t('business.onboarding.firstSale.upload.mainPhoto', 'Main')}
                  sx={{ position: 'absolute', top: 4, left: 4, height: 22, fontSize: '0.7rem', fontWeight: 600 }}
                />
              )}
              {cleanedFlags[i] && (
                <Tooltip title={t('business.images.cleanup.enhanced', 'Enhanced with AI')}>
                  <CheckCircleIcon
                    fontSize="small"
                    color="success"
                    sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'background.paper', borderRadius: '50%' }}
                  />
                </Tooltip>
              )}
              <Button
                size="small"
                variant="outlined"
                fullWidth
                startIcon={
                  cleanupLoading && cleanupIndex === i ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <AutoAwesomeIcon fontSize="small" />
                  )
                }
                disabled={cleanupLoading || cleanedFlags[i]}
                onClick={() => void runCleanupForIndex(i)}
                sx={{ mt: 0.75, fontSize: '0.75rem', textTransform: 'none' }}
              >
                {cleanedFlags[i]
                  ? t('business.images.cleanup.enhanced', 'Enhanced')
                  : cleanupLoading && cleanupIndex === i
                    ? t('business.images.cleanup.enhancing', 'Enhancing…')
                    : t('business.images.cleanup.enhanceBtn', 'Enhance with AI')}
              </Button>
            </Box>
          ))}
        </Box>
        <Divider />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            variant="outlined"
            onClick={() => void handleUploadAndContinue()}
            disabled={busy || submitting || cleanupLoading}
            fullWidth={isNarrow}
            startIcon={busy || submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {busy || submitting
              ? t('business.onboarding.firstSale.upload.uploading', 'Uploading…')
              : t('business.images.cleanup.skipAll', 'Skip & upload')}
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleUploadAndContinue()}
            disabled={busy || submitting || cleanupLoading}
            fullWidth={isNarrow}
            startIcon={busy || submitting ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
          >
            {busy || submitting
              ? t('business.onboarding.firstSale.upload.uploading', 'Uploading…')
              : t('business.images.cleanup.uploadAndContinue', 'Upload & Continue')}
          </Button>
        </Stack>
        <ImageCleanupPreviewDialog
          open={cleanupIndex !== null}
          onClose={() => { setCleanupIndex(null); setCleanupB64(null); }}
          originalUrl={cleanupIndex !== null ? objectUrls[cleanupIndex] ?? '' : ''}
          cleanedB64={cleanupB64}
          loading={cleanupLoading}
          onAccept={() => void acceptCleanup()}
          onReject={() => { setCleanupIndex(null); setCleanupB64(null); }}
        />
      </Stack>
    );
  }

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
        accept="image/*"
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
          disabled={busy || submitting}
          fullWidth={isNarrow}
        >
          {t('business.onboarding.firstSale.upload.chooseFiles', 'Choose images')}
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleContinue()}
          disabled={busy || submitting || validating || files.length < minPhotos}
          fullWidth={isNarrow}
          startIcon={
            busy || submitting || validating ? (
              <CircularProgress color="inherit" size={18} />
            ) : undefined
          }
        >
          {validating
            ? t('business.images.validation.validating', 'Checking image quality…')
            : busy || submitting
              ? t('business.onboarding.firstSale.upload.uploading', 'Uploading…')
              : t('business.onboarding.firstSale.upload.continue', 'Continue')}
        </Button>
      </Stack>

      <ImageCleanupPreviewDialog
        open={cleanupIndex !== null && !showCleanupStep}
        onClose={() => { setCleanupIndex(null); setCleanupB64(null); }}
        originalUrl={cleanupIndex !== null ? objectUrls[cleanupIndex] ?? '' : ''}
        cleanedB64={cleanupB64}
        loading={cleanupLoading}
        onAccept={() => void acceptCleanup()}
        onReject={() => { setCleanupIndex(null); setCleanupB64(null); }}
      />
    </Stack>
  );
};

export default FirstSaleItemUploadStep;
