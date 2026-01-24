import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ShippingLabelPrintModalProps {
  open: boolean;
  onClose: () => void;
  pdfBlob: Blob | null;
}

const PRINT_DELAY_MS = 800;

/**
 * Print PDF blob by opening it in a new window and calling print() there.
 * Avoids iframe + contentWindow.print() which throws SecurityError when the
 * PDF viewer runs cross-origin ("Blocked a frame... accessing a cross-origin frame").
 */
function printBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    URL.revokeObjectURL(url);
    return;
  }
  const tid = window.setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, PRINT_DELAY_MS);
  w.addEventListener('beforeunload', () => clearTimeout(tid));
}

const ShippingLabelPrintModal: React.FC<ShippingLabelPrintModalProps> = ({
  open,
  onClose,
  pdfBlob,
}) => {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pdfBlob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pdfBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdfBlob]);

  const handlePrint = () => {
    if (pdfBlob) printBlob(pdfBlob);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t('orders.shippingLabel.modalTitle', 'Print shipping label')}
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Box
            component="span"
            sx={{
              typography: 'subtitle2',
              color: 'text.secondary',
              alignSelf: 'flex-start',
            }}
          >
            {t('orders.shippingLabel.preview', 'Preview')}
          </Box>
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 360,
              bgcolor: 'grey.100',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            {previewUrl ? (
              <iframe
                src={previewUrl}
                title={t('orders.shippingLabel.iframeTitle', 'Shipping label PDF')}
                style={{
                  width: '100%',
                  maxWidth: 400,
                  height: 600,
                  border: 'none',
                }}
              />
            ) : null}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t('common.close', 'Close')}
        </Button>
        <Button variant="contained" onClick={handlePrint} disabled={!pdfBlob}>
          {t('orders.shippingLabel.print', 'Print')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShippingLabelPrintModal;
