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
import React, { useEffect, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useTranslation } from 'react-i18next';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface ShippingLabelPrintModalProps {
  open: boolean;
  onClose: () => void;
  pdfBlob: Blob | null;
  /** Called with message when print popup is blocked and we fall back to download */
  onPrintFallback?: (message: string) => void;
}

const PRINT_DELAY_MS = 1000;
const FILENAME = 'shipping-label.pdf';

/**
 * Open a new window synchronously (blank), then navigate to blob URL.
 * Bypasses many popup blockers that block window.open(url) but allow
 * window.open('') followed by location assign.
 */
function openBlobInNewWindow(url: string): Window | null {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return null;
  w.location.href = url;
  return w;
}

/**
 * Trigger download of blob as PDF. Use when print popup is blocked.
 */
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

/**
 * Print PDF blob: open in new window and call print() there.
 * If popup is blocked, fall back to download and invoke onFallback.
 */
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

  const [numPages, setNumPages] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setLoadError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    setLoadError(error?.message ?? 'Failed to load PDF');
  };

  useEffect(() => {
    if (!previewUrl) {
      setNumPages(null);
      setLoadError(null);
    }
  }, [previewUrl]);

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
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                py: 2,
              }}
            >
              <Document
                file={previewUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <Box sx={{ py: 6 }}>
                    <CircularProgress />
                  </Box>
                }
                error={
                  loadError ? (
                    <Typography color="error" sx={{ py: 3 }}>
                      {loadError}
                    </Typography>
                  ) : null
                }
              >
                {numPages != null &&
                  Array.from(new Array(numPages), (_, i) => (
                    <Page
                      key={`page-${i + 1}`}
                      pageNumber={i + 1}
                      width={384}
                      renderTextLayer
                      renderAnnotationLayer
                    />
                  ))}
              </Document>
            </Box>
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
