import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../../../contexts/UserProfileContext';
import { useBusinessImages } from '../../../../hooks/useBusinessImages';
import { useAws } from '../../../../hooks/useAws';
import { presignUploadLibraryImage } from '../onboardingPresignedUpload';
import type { SaleItemFromImageIntent } from './saleItemFromImageIntent';

interface FirstSaleItemUploadStepProps {
  intent?: SaleItemFromImageIntent;
  onComplete: (imageIds: string[], primaryFile: File) => void;
}

const FirstSaleItemUploadStep: React.FC<FirstSaleItemUploadStepProps> = ({
  intent = 'first',
  onComplete,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { profile } = useUserProfileContext();
  const { generateImageUploadUrl } = useAws();
  const { bulkCreateImages, submitting } = useBusinessImages();
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
        primary
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
    <Stack spacing={2}>
      <Typography variant="body1" color="text.secondary">
        {t(
          intent === 'first'
            ? 'business.onboarding.firstSale.upload.hint'
            : 'business.onboarding.firstSale.upload.hintAdditional',
          'Add one or more photos of your product. You can create the listing from the first image and attach the rest to the same item.'
        )}
      </Typography>
      <Alert severity="info">
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
          'business.onboarding.firstSale.upload.previewCaption',
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
            'business.onboarding.firstSale.upload.chooseFiles',
            'Choose images'
          )}
        </Button>
        <Button
          variant="contained"
          onClick={() => void uploadAll()}
          disabled={busy || submitting || !files.length}
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
