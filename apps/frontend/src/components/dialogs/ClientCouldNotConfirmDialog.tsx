import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAws } from '../../hooks/useAws';
import type { DeliveryProofPhotoInput } from '../../types/deliveryConfirmation';
import {
  publicS3Url,
  putFileToPresignedUrl,
  readBrowserGps,
  toProofPhotoInput,
} from '../../utils/uploadDeliveryProofPhoto';

type Props = {
  open: boolean;
  orderId: string;
  submitting?: boolean;
  errorText?: string | null;
  onClose: () => void;
  onSubmit: (photos: DeliveryProofPhotoInput[]) => void;
};

const ClientCouldNotConfirmDialog: React.FC<Props> = ({
  open,
  orderId,
  submitting,
  errorText,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const { generateImageUploadUrl } = useAws();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [photos, setPhotos] = useState<DeliveryProofPhotoInput[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const reset = () => {
    setPhotos([]);
    setNote('');
    setLocalError(null);
    onClose();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setLocalError(null);
    try {
      const gps = await readBrowserGps();
      const presigned = await generateImageUploadUrl({
        bucketName: process.env.REACT_APP_S3_BUCKET_NAME || 'rendasua-uploads',
        originalFileName: file.name,
        contentType: file.type || 'image/jpeg',
        prefix: `orders/${orderId}/delivery-proof`,
      });
      if (!presigned?.success || !presigned.data?.url || !presigned.data?.key) {
        throw new Error(presigned?.error || 'Failed to prepare photo upload');
      }
      await putFileToPresignedUrl(presigned.data.url, file);
      setPhotos((prev) => [
        ...prev,
        toProofPhotoInput(publicS3Url(presigned.data.key), gps, note),
      ]);
    } catch (e: any) {
      setLocalError(e?.message || t('common.genericError', 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={reset} fullWidth maxWidth="sm">
      <DialogTitle>
        {t('orders.clientConfirm.agentFallbackCta', "Client couldn't confirm")}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2">
            {t('orders.clientConfirm.agentFallbackPhoto', 'Take a photo of the delivered order')}
          </Typography>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <Button
            variant="outlined"
            onClick={() => inputRef.current?.click()}
            disabled={busy || submitting}
          >
            {t('orders.clientConfirm.takePhoto', 'Take photo')}
          </Button>
          {photos.map((p) => (
            <BoxImage key={p.photoUrl} src={p.photoUrl} />
          ))}
          <TextField
            label={t('orders.clientConfirm.photoNoteOptional', 'Note (optional)')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy || submitting}
          />
          {localError || errorText ? (
            <Typography color="error" variant="body2">
              {localError || errorText}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={reset} disabled={busy || submitting}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={busy || submitting || photos.length < 1}
          onClick={() =>
            onSubmit(photos.map((p) => ({ ...p, note: note.trim() || p.note })))
          }
        >
          {t('orders.clientConfirm.submitFallback', 'Submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

function BoxImage({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8 }}
    />
  );
}

export default ClientCouldNotConfirmDialog;
