import { Close as CloseIcon, CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../../../contexts/UserProfileContext';
import { useAws } from '../../../../hooks/useAws';
import { useRentalItemImages } from '../../../../hooks/useRentalItemImages';
import { presignUploadLibraryImage } from '../onboardingPresignedUpload';
import type { FirstRentalUploadResult } from './firstRentalUploadTypes';

interface FirstRentalItemUploadStepProps {
  onComplete: (result: FirstRentalUploadResult) => void;
}

const FirstRentalItemUploadStep: React.FC<FirstRentalItemUploadStepProps> = ({
  onComplete,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfileContext();
  const { generateImageUploadUrl } = useAws();
  const { bulkCreateImages, submitting } = useRentalItemImages();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  useEffect(() => {
    if (!files.length) {
      setMainImageIndex(0);
      return;
    }
    setMainImageIndex((m) => Math.min(m, files.length - 1));
  }, [files.length]);

  const bucketName =
    process.env.REACT_APP_S3_BUCKET_NAME || 'rendasua-uploads';

  const pickFiles = () => inputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(e.target.files || []);
    if (next.length) setFiles((prev) => [...prev, ...next]);
    e.target.value = '';
  };

  const removeAt = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setMainImageIndex((m) => {
      if (i < m) return m - 1;
      if (i === m) return Math.max(0, m - 1);
      return m;
    });
  };

  const uploadAll = async () => {
    const bid = profile?.business?.id;
    if (!bid || !files.length) return;
    setBusy(true);
    try {
      const prefix = `businesses/${bid}/rental-images`;
      const errMsg = t(
        'business.onboarding.firstRental.upload.presignError',
        'Failed to prepare upload'
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
      const rows = await bulkCreateImages(
        { images: payloads },
        { skipRefetch: true }
      );
      if (!rows.length) {
        throw new Error(
          t(
            'business.onboarding.firstRental.upload.noIds',
            'Upload did not return image ids'
          )
        );
      }
      enqueueSnackbar(
        t(
          'business.onboarding.firstRental.upload.success',
          'Images uploaded'
        ),
        { variant: 'success' }
      );
      onComplete({
        imageIds: rows.map((r) => r.id),
        files,
        mainImageIndex: Math.min(mainImageIndex, files.length - 1),
      });
    } catch (e: any) {
      enqueueSnackbar(
        e?.message ||
          t(
            'business.onboarding.firstRental.upload.error',
            'Upload failed'
          ),
        { variant: 'error' }
      );
    } finally {
      setBusy(false);
    }
  };

  const mainIdx = files.length
    ? Math.min(mainImageIndex, files.length - 1)
    : 0;
  const heroUrl = previewUrls[mainIdx];

  return (
    <Stack spacing={2}>
      <Typography variant="body1" color="text.secondary">
        {t(
          'business.onboarding.firstRental.upload.hint',
          'Add one or more photos. Choose which image is the main listing photo, then continue.'
        )}
      </Typography>
      <Alert severity="info">
        {t(
          'business.onboarding.firstRental.upload.clearPhotoNote',
          'Use clear, well-lit photos of the item you rent on a simple background so renters (and AI, if you use it) can see details easily.'
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
      {heroUrl && files[mainIdx] ? (
        <Box
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            bgcolor: 'grey.50',
            maxHeight: 280,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            component="img"
            src={heroUrl}
            alt=""
            sx={{
              maxHeight: 260,
              width: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </Box>
      ) : null}
      {files.length > 0 ? (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t(
              'business.onboarding.firstRental.upload.mainPhotoLabel',
              'Main listing photo — tap a thumbnail to select'
            )}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {files.map((f, i) => (
              <Box
                key={`${f.name}-${i}-${previewUrls[i] ?? ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setMainImageIndex(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setMainImageIndex(i);
                  }
                }}
                sx={{
                  position: 'relative',
                  border: 2,
                  borderColor: mainIdx === i ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  overflow: 'hidden',
                  width: 88,
                  height: 88,
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              >
                {previewUrls[i] ? (
                  <Box
                    component="img"
                    src={previewUrls[i]}
                    alt=""
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : null}
                {mainIdx === i ? (
                  <Chip
                    size="small"
                    label={t('business.onboarding.firstRental.upload.mainBadge', 'Main')}
                    sx={{
                      position: 'absolute',
                      bottom: 4,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      height: 20,
                      fontSize: '0.65rem',
                    }}
                  />
                ) : null}
                <IconButton
                  size="small"
                  aria-label={t('common.remove', 'Remove')}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    removeAt(i);
                  }}
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    bgcolor: 'background.paper',
                    '&:hover': { bgcolor: 'grey.200' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            ))}
          </Stack>
        </Box>
      ) : null}
      <Typography variant="caption" color="text.secondary">
        {t(
          'business.onboarding.firstRental.upload.previewCaption',
          'Large preview shows the image selected as main.'
        )}
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Button
          variant="outlined"
          startIcon={<CloudUploadIcon />}
          onClick={pickFiles}
          disabled={busy || submitting}
        >
          {t(
            'business.onboarding.firstRental.upload.chooseFiles',
            'Choose images'
          )}
        </Button>
        <Button
          variant="contained"
          onClick={() => void uploadAll()}
          disabled={busy || submitting || !files.length}
        >
          {t('business.onboarding.firstRental.upload.continue', 'Continue')}
        </Button>
      </Stack>
    </Stack>
  );
};

export default FirstRentalItemUploadStep;
