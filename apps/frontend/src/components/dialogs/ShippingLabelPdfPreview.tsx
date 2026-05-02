import { Box, CircularProgress, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface ShippingLabelPdfPreviewProps {
  previewUrl: string;
}

const ShippingLabelPdfPreview: React.FC<ShippingLabelPdfPreviewProps> = ({
  previewUrl,
}) => {
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
  );
};

export default ShippingLabelPdfPreview;
