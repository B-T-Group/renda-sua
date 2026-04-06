import {
  Close as CloseIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../../../contexts/UserProfileContext';
import { useBusinessImages } from '../../../../hooks/useBusinessImages';
import { useAws } from '../../../../hooks/useAws';
import { presignUploadLibraryImage } from '../onboardingPresignedUpload';
import type { SaleItemFromImageIntent } from './saleItemFromImageIntent';

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
  const { profile } = useUserProfileContext();
  const { generateImageUploadUrl } = useAws();
  const { bulkCreateImages, submitting } = useBusinessImages();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const objectUrls = useMemo(
    () => files.map((f) => URL.createObjectURL(f)),
    [files]
  );

  useEffect(() => {
    return () => objectUrls.forEach((u) => URL.revokeObjectURL(u));
  }, [objectUrls]);

  const bucketName =
    process.env.REACT_APP_S3_BUCKET_NAME || 'rendasua-uploads';

  const pickFiles = () => inputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(e.target.files || []);
    if (next.length) setFiles((prev) => [...prev, ...next]);
    e.target.value = '';
  };

  const removeAt = (i: number) => {
    setPreviewIndex((prev) => {
      if (prev === null) return null;
      if (prev === i) return null;
      if (prev > i) return prev - 1;
      return prev;
    });
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
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

  const uploadAll = async () => {
    const bid = profile?.business?.id;
    const primary = files[0];
    if (!bid || !files.length || !primary) return;
    setBusy(true);
    try {
      const prefix = `businesses/${bid}/images`;
      const errMsg = t(
        'business.onboarding.firstSale.upload.presignError',
        'Failed to prepare image upload'
      );
      const payloads = [];
      for (const file of files) {
        payloads.push(
          await presignUploadLibraryImage(
            file,
            bucketName,
            prefix,
            generateImageUploadUrl,
            errMsg
          )
        );
      }
      const ids = await bulkCreateImages(
        { images: payloads },
        { skipRefetch: true }
      );
      if (!ids.length) {
        throw new Error(
          t(
            'business.onboarding.firstSale.upload.noIds',
            'Upload did not return image ids'
          )
        );
      }
      enqueueSnackbar(
        t(
          'business.onboarding.firstSale.upload.success',
          'Images uploaded successfully'
        ),
        { variant: 'success' }
      );
      onComplete(
        ids.map((r) => r.id),
        files
      );
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t(
            'business.onboarding.firstSale.upload.error',
            'Failed to upload images'
          ),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={{ xs: 2.5, sm: 2 }}>
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
      <Alert
        severity="info"
        sx={{
          '& .MuiAlert-message': { fontSize: { xs: '0.8125rem', sm: '0.875rem' } },
        }}
      >
        {t(
          'business.onboarding.firstSale.upload.clearPhotoNote',
          'Use a clear, well-lit photo of your product on a simple background so buyers (and AI, if you use it) can see details easily.'
        )}
      </Alert>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onFileChange}
      />
      {files.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            justifyContent: { xs: 'center', sm: 'flex-start' },
          }}
        >
          {files.map((f, i) => (
            <Box
              key={`${f.name}-${i}`}
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
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'hidden',
                  bgcolor: 'grey.50',
                  cursor: 'pointer',
                  display: 'block',
                  width: '100%',
                  '&:focus-visible': {
                    outline: 2,
                    outlineColor: 'primary.main',
                    outlineOffset: 2,
                  },
                }}
                aria-label={t(
                  'business.onboarding.firstSale.upload.previewPhoto',
                  'Preview {{name}}',
                  { name: f.name }
                )}
              >
                <Box
                  component="img"
                  src={objectUrls[i]}
                  alt=""
                  sx={{
                    width: '100%',
                    height: { xs: 120, sm: 112 },
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(i);
                }}
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
              {i === 0 ? (
                <Chip
                  size="small"
                  color="primary"
                  label={t(
                    'business.onboarding.firstSale.upload.mainPhoto',
                    'Main'
                  )}
                  sx={{
                    position: 'absolute',
                    top: 2,
                    left: 2,
                    height: 22,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}
                />
              ) : null}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  mt: 0.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={f.name}
              >
                {f.name}
              </Typography>
              {files.length > 1 && i > 0 ? (
                <Button
                  type="button"
                  size="small"
                  variant="text"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAsMainAt(i);
                  }}
                  sx={{
                    mt: 0.25,
                    minHeight: 0,
                    py: 0.25,
                    px: 0,
                    fontSize: '0.75rem',
                    textTransform: 'none',
                  }}
                >
                  {t(
                    'business.onboarding.firstSale.upload.setAsMain',
                    'Set as main'
                  )}
                </Button>
              ) : null}
            </Box>
          ))}
        </Box>
      )}
      <Typography variant="caption" color="text.secondary">
        {t(
          'business.onboarding.firstSale.upload.previewHint',
          'The main listing photo is on the left. Tap a photo to view it full size.'
        )}
      </Typography>
      <Dialog
        open={previewIndex !== null && previewIndex < objectUrls.length}
        onClose={() => setPreviewIndex(null)}
        maxWidth="lg"
        fullWidth
        aria-labelledby="first-sale-image-preview-title"
      >
        <DialogContent
          sx={{
            p: 1,
            position: 'relative',
            bgcolor: 'grey.900',
          }}
        >
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
              alt=""
              sx={{
                width: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
                display: 'block',
                mx: 'auto',
              }}
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
        sx={{
          '& .MuiButton-root': {
            minHeight: 48,
            width: { xs: '100%', sm: 'auto' },
          },
        }}
      >
        <Button
          variant="outlined"
          startIcon={<CloudUploadIcon />}
          onClick={pickFiles}
          disabled={busy || submitting}
          fullWidth={isNarrow}
        >
          {t(
            'business.onboarding.firstSale.upload.chooseFiles',
            'Choose images'
          )}
        </Button>
        <Button
          variant="contained"
          onClick={() => void uploadAll()}
          disabled={busy || submitting || !files.length}
          fullWidth={isNarrow}
          startIcon={
            busy || submitting ? (
              <CircularProgress color="inherit" size={18} />
            ) : undefined
          }
        >
          {busy || submitting
            ? t(
                'business.onboarding.firstSale.upload.uploading',
                'Uploading…'
              )
            : t('business.onboarding.firstSale.upload.continue', 'Continue')}
        </Button>
      </Stack>
    </Stack>
  );
};

export default FirstSaleItemUploadStep;
