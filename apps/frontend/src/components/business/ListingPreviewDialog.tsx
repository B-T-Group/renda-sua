import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface ListingPreviewModel {
  title: string;
  imageUrl?: string | null;
  priceLine?: string | null;
  metaLines?: string[];
  description?: string | null;
  locationLine?: string | null;
}

export interface ListingPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  model: ListingPreviewModel;
}

const ListingPreviewDialog: React.FC<ListingPreviewDialogProps> = ({
  open,
  onClose,
  model,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t('business.listingPreview.title', 'Listing preview')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            'business.listingPreview.buyerHint',
            'Approximate view of what customers will see'
          )}
        </Typography>
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: 'background.paper',
          }}
        >
          {model.imageUrl ? (
            <Box
              component="img"
              src={model.imageUrl}
              alt=""
              sx={{
                width: '100%',
                height: 200,
                objectFit: 'cover',
                display: 'block',
                bgcolor: 'grey.100',
              }}
            />
          ) : (
            <Box
              sx={{
                height: 140,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'grey.100',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {t('business.listingPreview.noPhoto', 'No photo')}
              </Typography>
            </Box>
          )}
          <Box sx={{ p: 2 }}>
            <Typography variant="h6">{model.title}</Typography>
            {model.priceLine ? (
              <Typography variant="subtitle1" color="primary" sx={{ mt: 0.5 }}>
                {model.priceLine}
              </Typography>
            ) : null}
            {model.locationLine ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {model.locationLine}
              </Typography>
            ) : null}
            {(model.metaLines ?? []).map((line) => (
              <Typography key={line} variant="body2" color="text.secondary">
                {line}
              </Typography>
            ))}
            {model.description ? (
              <Typography variant="body1" sx={{ mt: 1.5 }} whiteSpace="pre-wrap">
                {model.description}
              </Typography>
            ) : null}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close', 'Close')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ListingPreviewDialog;
