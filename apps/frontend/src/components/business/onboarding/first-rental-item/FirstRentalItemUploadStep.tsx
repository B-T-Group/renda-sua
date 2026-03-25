import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
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

interface FirstRentalItemUploadStepProps {
  onComplete: (imageIds: string[], primaryFile: File) => void;
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const firstFile = files[0];

  useEffect(() => {
    if (!firstFile) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(firstFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [firstFile]);

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
  };

  const uploadAll = async () => {
    const bid = profile?.business?.id;
    const primary = files[0];
    if (!bid || !files.length || !primary) return;
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
      onComplete(
        rows.map((r) => r.id),
        primary
      );
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

  return (
    <Stack spacing={2}>
      <Typography variant="body1" color="text.secondary">
        {t(
          'business.onboarding.firstRental.upload.hint',
          'Add photos of what you rent out. We will create the rental from your first image and can attach the rest to the same item.'
        )}
      </Typography>
      <Alert severity="info">
        {t(
          'business.onboarding.firstRental.upload.clearPhotoNote',
          'Use a clear, well-lit photo of the item you rent on a simple background so renters (and AI, if you use it) can see details easily.'
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
      {previewUrl && firstFile && (
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
            src={previewUrl}
            alt=""
            sx={{
              maxHeight: 260,
              width: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </Box>
      )}
      <Typography variant="caption" color="text.secondary">
        {t(
          'business.onboarding.firstRental.upload.previewCaption',
          'Preview shows your first image only.'
        )}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {files.map((f, i) => (
          <Chip key={`${f.name}-${i}`} label={f.name} onDelete={() => removeAt(i)} />
        ))}
      </Box>
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
