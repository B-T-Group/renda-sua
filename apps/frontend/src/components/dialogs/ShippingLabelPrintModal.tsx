import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const ShippingLabelPdfPreview = lazy(() =>
  import(
    /* webpackChunkName: "vendor-pdf-preview" */
    './ShippingLabelPdfPreview'
  )
);

export interface ShippingLabelPrintModalProps {
  open: boolean;
  onClose: () => void;
  pdfBlob: Blob | null;
  /** Called with message when print popup is blocked and we fall back to download */
  onPrintFallback?: (message: string) => void;
}

const PRINT_DELAY_MS = 1000;
const FILENAME = 'shipping-label.pdf';

function openBlobInNewWindow(url: string): Window | null {
  const w = window.open('', '_blank');
  if (!w) return null;
  w.location.href = url;
  return w;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function printBlob(blob: Blob, onFallback?: () => void): void {
  const url = URL.createObjectURL(blob);
  const w = openBlobInNewWindow(url);
  if (!w) {
    URL.revokeObjectURL(url);
    downloadBlob(blob, FILENAME);
    onFallback?.();
    return;
  }
  const tid = window.setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, PRINT_DELAY_MS);
  w.addEventListener('beforeunload', () => clearTimeout(tid));
}

const ShippingLabelPrintModal: React.FC<ShippingLabelPrintModalProps> = ({
  open,
  onClose,
  pdfBlob,
  onPrintFallback,
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
    if (!pdfBlob) return;
    const fallbackMsg = t(
      'orders.shippingLabel.popupBlockedFallback',
      'Popup blocked. Label downloaded — open the file and print from your PDF viewer.'
    );
    printBlob(pdfBlob, () => onPrintFallback?.(fallbackMsg));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('orders.shippingLabel.modalTitle', 'Print shipping label')}
      </DialogTitle>
      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        <Box
          sx={{
            width: '100%',
            minHeight: 520,
            maxHeight: '70vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            bgcolor: 'grey.100',
            overflow: 'auto',
          }}
        >
          {previewUrl ? (
            <Suspense
              fallback={
                <Box sx={{ py: 6 }}>
                  <CircularProgress />
                </Box>
              }
            >
              <ShippingLabelPdfPreview previewUrl={previewUrl} />
            </Suspense>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose}>{t('common.close', 'Close')}</Button>
        <Button variant="contained" onClick={handlePrint} disabled={!pdfBlob}>
          {t('orders.shippingLabel.print', 'Print')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShippingLabelPrintModal;
