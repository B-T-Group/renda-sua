import {
  Close as CloseIcon,
  Download as DownloadIcon,
  Info as InfoIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useApiClient } from '../../hooks/useApiClient';
import { CSV_ITEMS_TEMPLATE_HEADERS } from './csvItemsTemplate';

interface CSVUploadDialogProps {
  open: boolean;
  onClose: () => void;
  businessId: string;
  /** Called after a successful upload so the parent can refetch page data */
  onUploadSuccess?: () => void;
}

interface CSVItemWithInventory {
  // Item fields
  name: string;
  description?: string;
  price: number;
  currency: string;
  sku?: string;
  weight?: number;
  weight_unit?: string;
  dimensions?: string;
  color?: string;
  model?: string;
  is_fragile?: boolean;
  is_perishable?: boolean;
  requires_special_handling?: boolean;
  min_order_quantity?: number;
  max_order_quantity?: number;
  is_active?: boolean;
  item_sub_category_id?: number;
  brand_id?: string;

  // Inventory fields
  business_location_name: string;
  quantity: number;
  reserved_quantity: number;
  reorder_point: number;
  reorder_quantity: number;
  unit_cost: number;
  selling_price: number;

  // Image fields
  image_url?: string;
  image_alt_text?: string;
  image_caption?: string;

  // Internal fields
  business_id: string;
}

interface UploadResult {
  success: number;
  errors: number;
  details: {
    inserted: string[];
    updated: string[];
    errors: Array<{ row: number; error: string }>;
  };
}

export default function CSVUploadDialog({
  open,
  onClose,
  businessId,
  onUploadSuccess,
}: CSVUploadDialogProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const apiClient = useApiClient();
  const { profile } = useUserProfileContext();

  const [csvData, setCsvData] = useState<CSVItemWithInventory[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [previewData, setPreviewData] = useState<CSVItemWithInventory[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{
    processed: number;
    total: number;
    currentBatch: number;
    totalBatches: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const CSV_BATCH_SIZE = 10;
  const BATCH_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes per batch

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      enqueueSnackbar(t('business.csvUpload.invalidFileType'), {
        variant: 'error',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (csvText: string) => {
    try {
      const lines = csvText.split('\n').filter((line) => line.trim());
      if (lines.length < 2) {
        enqueueSnackbar(t('business.csvUpload.emptyFile'), {
          variant: 'error',
        });
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const data: CSVItemWithInventory[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim());
        const row: any = {};

        headers.forEach((header, index) => {
          const value = values[index] || '';

          // Convert boolean strings to actual booleans
          if (
            [
              'is_fragile',
              'is_perishable',
              'requires_special_handling',
              'is_active',
            ].includes(header)
          ) {
            row[header] =
              value.toLowerCase() === 'true' || value.toLowerCase() === '1';
          }
          // Convert numeric strings to numbers
          else if (
            [
              'price',
              'size',
              'weight',
              'min_order_quantity',
              'max_order_quantity',
              'item_sub_category_id',
              'quantity',
              'reserved_quantity',
              'reorder_point',
              'reorder_quantity',
              'unit_cost',
              'selling_price',
            ].includes(header)
          ) {
            row[header] = value ? parseFloat(value) : undefined;
          }
          // Keep strings as is
          else {
            row[header] = value || undefined;
          }
        });

        // Add business_id to each item
        row.business_id = businessId;

        data.push(row);
      }

      setCsvData(data);
      setPreviewData(data.slice(0, 5)); // Show first 5 rows as preview
      setUploadResult(null);
    } catch (error) {
      enqueueSnackbar(t('business.csvUpload.parseError'), { variant: 'error' });
    }
  };

  const handleUpload = async () => {
    if (csvData.length === 0) {
      enqueueSnackbar(t('business.csvUpload.noData'), { variant: 'error' });
      return;
    }

    if (!profile?.id) {
      enqueueSnackbar(t('business.inventory.userIdRequired'), {
        variant: 'error',
      });
      return;
    }

    setUploading(true);
    setUploadResult(null);
    const totalBatches = Math.ceil(csvData.length / CSV_BATCH_SIZE);
    setUploadProgress({ processed: 0, total: csvData.length, currentBatch: 0, totalBatches });

    const aggregatedResult: UploadResult = {
      success: 0,
      errors: 0,
      details: { inserted: [], updated: [], errors: [] },
    };

    try {
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * CSV_BATCH_SIZE;
        const end = Math.min(start + CSV_BATCH_SIZE, csvData.length);
        const batch = csvData.slice(start, end);
        const rowOffset = start;

        setUploadProgress({
          processed: start,
          total: csvData.length,
          currentBatch: batchIndex + 1,
          totalBatches,
        });

        const response = await apiClient.post<{
          success: boolean;
          data: {
            success: number;
            inserted: number;
            updated: number;
            errors: number;
            details: UploadResult['details'];
          };
        }>('/business-items/csv-upload', { rows: batch, rowOffset }, {
          timeout: BATCH_TIMEOUT_MS,
        });

        const data = response.data?.data;
        if (data) {
          aggregatedResult.success += data.success;
          aggregatedResult.errors += data.errors;
          aggregatedResult.details.inserted.push(...data.details.inserted);
          aggregatedResult.details.updated.push(...data.details.updated);
          aggregatedResult.details.errors.push(...data.details.errors);
        }

        setUploadProgress({
          processed: end,
          total: csvData.length,
          currentBatch: batchIndex + 1,
          totalBatches,
        });
      }

      setUploadResult(aggregatedResult);

      if (aggregatedResult.success > 0) {
        enqueueSnackbar(
          t('business.csvUpload.uploadSuccess', {
            success: aggregatedResult.success,
            errors: aggregatedResult.errors,
          }),
          { variant: 'success' }
        );
        onUploadSuccess?.();
      }
    } catch (err: unknown) {
      let errorMessage = 'Upload failed';
      if (err instanceof Error) errorMessage = err.message;
      const res = (err as { response?: { data?: { error?: string } } }).response;
      if (res?.data?.error) errorMessage = res.data.error;
      const failedBatchSize = csvData.length - (uploadProgress?.processed ?? 0);
      setUploadResult({
        success: aggregatedResult.success,
        errors: aggregatedResult.errors + failedBatchSize,
        details: {
          inserted: aggregatedResult.details.inserted,
          updated: aggregatedResult.details.updated,
          errors: [
            ...aggregatedResult.details.errors,
            {
              row: (uploadProgress?.processed ?? 0) + 2,
              error: errorMessage,
            },
          ],
        },
      });
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const downloadTemplate = () => {
    const headers = [...CSV_ITEMS_TEMPLATE_HEADERS];

    const sampleData = [
      'Sample Item',
      'This is a sample item description',
      '29.99',
      'USD',
      'SAMPLE-001',
      '1.5',
      'kg',
      '10 x 20 x 5 cm',
      'Red',
      'Model-X',
      'false',
      'false',
      'false',
      '1',
      '100',
      'true',
      '1',
      '',
      'Main Warehouse',
      '100',
      '5',
      '10',
      '20',
      '15.00',
      '29.99',
      'https://example.com/images/sample-item.jpg',
      'Sample item image',
      'Main product image',
    ];

    const csvContent = [headers.join(','), sampleData.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'items_with_inventory_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setCsvData([]);
    setPreviewData([]);
    setUploadResult(null);
    setUploadProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const renderPreviewTable = () => {
    return (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Image</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {previewData.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.name}</TableCell>
                <TableCell>
                  {item.price} {item.currency}
                </TableCell>
                <TableCell>{item.business_location_name}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{item.image_url ? 'Yes' : 'No'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{t('business.csvUpload.title')}</Typography>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Instructions */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" mb={1}>
              <InfoIcon sx={{ mr: 1, color: 'info.main' }} />
              <Typography variant="subtitle2" color="info.main">
                {t('business.csvUpload.howToUse')}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Upload a CSV file to create items, inventory records, and add
              images in one operation. Each row should contain item details,
              inventory information, and an optional image URL.
            </Typography>
            <Typography variant="body2" color="info.main" sx={{ mt: 1, fontWeight: 500 }}>
              {t('business.csvUpload.takesSomeTime')}
            </Typography>
            <Box mt={2}>
              <Button
                startIcon={<DownloadIcon />}
                onClick={downloadTemplate}
                variant="outlined"
                size="small"
              >
                {t('business.csvUpload.downloadTemplate')}
              </Button>
            </Box>
          </Paper>

          {/* File Upload */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              fullWidth
              sx={{ py: 2 }}
            >
              {t('business.csvUpload.selectFile')}
            </Button>
          </Paper>

          {/* Upload Progress */}
          {uploading && uploadProgress && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('business.csvUpload.progress', {
                  processed: uploadProgress.processed,
                  total: uploadProgress.total,
                  batch: uploadProgress.currentBatch,
                  totalBatches: uploadProgress.totalBatches,
                })}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(uploadProgress.processed / uploadProgress.total) * 100}
                sx={{ mt: 1, height: 8, borderRadius: 1 }}
              />
            </Paper>
          )}

          {/* Preview */}
          {previewData.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('business.csvUpload.preview')} ({csvData.length} items)
              </Typography>
              {renderPreviewTable()}
            </Paper>
          )}

          {/* Upload Results */}
          {uploadResult && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('business.csvUpload.results')}
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2">
                  ✅ {t('business.csvUpload.inserted')}:{' '}
                  {uploadResult.details.inserted.length}
                </Typography>
                <Typography variant="body2">
                  🔄 {t('business.csvUpload.updated')}:{' '}
                  {uploadResult.details.updated.length}
                </Typography>
                <Typography variant="body2" color="error">
                  ❌ {t('business.csvUpload.errors')}:{' '}
                  {uploadResult.details.errors.length}
                </Typography>
              </Stack>

              {uploadResult.details.errors.length > 0 && (
                <Box mt={2}>
                  <Typography variant="caption" color="error" display="block">
                    {t('business.csvUpload.errorDetails')}:
                  </Typography>
                  {uploadResult.details.errors
                    .slice(0, 5)
                    .map((error, index) => (
                      <Typography
                        key={index}
                        variant="caption"
                        color="error"
                        display="block"
                      >
                        Row {error.row}: {error.error}
                      </Typography>
                    ))}
                  {uploadResult.details.errors.length > 5 && (
                    <Typography variant="caption" color="error">
                      ... and {uploadResult.details.errors.length - 5} more
                      errors
                    </Typography>
                  )}
                </Box>
              )}
            </Paper>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={csvData.length === 0 || uploading}
        >
          {uploading && uploadProgress
            ? t('business.csvUpload.uploadingBatch', {
                batch: uploadProgress.currentBatch,
                totalBatches: uploadProgress.totalBatches,
              })
            : t('business.csvUpload.upload')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
