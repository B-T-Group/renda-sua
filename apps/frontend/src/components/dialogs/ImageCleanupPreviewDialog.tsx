import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import ImageCleanupLoadingAnimation from '../common/ImageCleanupLoadingAnimation';

export interface ImageCleanupPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  originalUrl: string;
  cleanedB64: string | null;
  loading: boolean;
  onAccept: () => void;
  onReject: () => void;
}

const ImageCleanupPreviewDialog: React.FC<ImageCleanupPreviewDialogProps> = ({
  open,
  onClose,
  originalUrl,
  cleanedB64,
  loading,
  onAccept,
  onReject,
}) => {
  const { t } = useTranslation();

  const handleAccept = () => {
    onAccept();
  };

  const handleReject = () => {
    onReject();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t(
          'business.images.cleanup.previewTitle',
          'Preview cleaned image'
        )}
      </DialogTitle>
      <DialogContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ mt: 1 }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">
              {t('business.images.cleanup.original', 'Original')}
            </Typography>
            <Box
              component="img"
              src={originalUrl}
              alt="Original"
              sx={{
                width: '100%',
                maxHeight: 320,
                objectFit: 'contain',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">
              {t('business.images.cleanup.cleaned', 'Cleaned')}
            </Typography>
            {loading ? (
              <ImageCleanupLoadingAnimation />
            ) : cleanedB64 ? (
              <Box
                component="img"
                src={`data:image/png;base64,${cleanedB64}`}
                alt="Cleaned"
                sx={{
                  width: '100%',
                  maxHeight: 320,
                  objectFit: 'contain',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: 320,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  —
                </Typography>
              </Box>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleReject}>
          {t('business.images.cleanup.reject', 'Reject')}
        </Button>
        <Button
          variant="contained"
          onClick={handleAccept}
          disabled={loading || !cleanedB64}
        >
          {t('business.images.cleanup.accept', 'Accept and replace')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImageCleanupPreviewDialog;
