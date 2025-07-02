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
import { useItems } from '../../hooks/useItems';

interface CSVUploadDialogProps {
  open: boolean;
  onClose: () => void;
  businessId: string;
}

interface CSVItem {
  name: string;
  description?: string;
  price: number;
  currency: string;
  sku?: string;
  size?: number;
  size_unit?: string;
  weight?: number;
  weight_unit?: string;
  color?: string;
  material?: string;
  model?: string;
  is_fragile?: boolean;
  is_perishable?: boolean;
  requires_special_handling?: boolean;
  min_order_quantity?: number;
  max_order_quantity?: number;
  is_active?: boolean;
  item_sub_category_id?: number;
  brand_id?: string;
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

interface CreateItemData {
  name: string;
  description: string;
  item_sub_category_id: number;
  price: number;
  currency: string;
  business_id: string;
  sku?: string;
  size?: number;
  size_unit?: string;
  weight?: number;
  weight_unit?: string;
  color?: string;
  material?: string;
  model?: string;
  is_fragile?: boolean;
  is_perishable?: boolean;
  requires_special_handling?: boolean;
  min_order_quantity?: number;
  max_order_quantity?: number;
  is_active?: boolean;
  brand_id?: string;
}

export default function CSVUploadDialog({
  open,
  onClose,
  businessId,
}: CSVUploadDialogProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { createItem, updateItem, items } = useItems(businessId);

  const [csvData, setCsvData] = useState<CSVItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [previewData, setPreviewData] = useState<CSVItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const data: CSVItem[] = [];

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

    setUploading(true);
    const result: UploadResult = {
      success: 0,
      errors: 0,
      details: {
        inserted: [],
        updated: [],
        errors: [],
      },
    };

    for (let i = 0; i < csvData.length; i++) {
      const item = csvData[i];
      try {
        // Check if item already exists by name or SKU
        const existingItem = items.find(
          (existing) =>
            existing.name.toLowerCase() === item.name.toLowerCase() ||
            (item.sku &&
              existing.sku &&
              existing.sku.toLowerCase() === item.sku.toLowerCase())
        );

        if (existingItem) {
          // Update existing item
          await updateItem(existingItem.id, item);
          result.details.updated.push(item.name);
          result.success++;
        } else {
          // Create new item - ensure required fields are present
          const createData: CreateItemData = {
            name: item.name,
            description: item.description || '', // Required field
            item_sub_category_id: item.item_sub_category_id || 1, // Required field, default to 1
            price: item.price,
            currency: item.currency,
            business_id: item.business_id,
            // Optional fields
            sku: item.sku,
            size: item.size,
            size_unit: item.size_unit,
            weight: item.weight,
            weight_unit: item.weight_unit,
            color: item.color,
            material: item.material,
            model: item.model,
            is_fragile: item.is_fragile,
            is_perishable: item.is_perishable,
            requires_special_handling: item.requires_special_handling,
            min_order_quantity: item.min_order_quantity,
            max_order_quantity: item.max_order_quantity,
            is_active: item.is_active,
            brand_id: item.brand_id,
          };
          await createItem(createData);
          result.details.inserted.push(item.name);
          result.success++;
        }
      } catch (error) {
        result.errors++;
        result.details.errors.push({
          row: i + 2, // +2 because of 0-based index and header row
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    setUploadResult(result);
    setUploading(false);

    if (result.success > 0) {
      enqueueSnackbar(
        t('business.csvUpload.uploadSuccess', {
          success: result.success,
          errors: result.errors,
        }),
        { variant: 'success' }
      );
    }
  };

  const downloadTemplate = () => {
    const headers = [
      'name',
      'description',
      'price',
      'currency',
      'sku',
      'size',
      'size_unit',
      'weight',
      'weight_unit',
      'color',
      'material',
      'model',
      'is_fragile',
      'is_perishable',
      'requires_special_handling',
      'min_order_quantity',
      'max_order_quantity',
      'is_active',
      'item_sub_category_id',
      'brand_id',
    ];

    const sampleData = [
      'Sample Item',
      'This is a sample item description',
      '29.99',
      'USD',
      'SAMPLE-001',
      '10',
      'cm',
      '500',
      'g',
      'Red',
      'Plastic',
      'Model-X',
      'false',
      'false',
      'false',
      '1',
      '100',
      'true',
      '1',
      '',
    ];

    const csvContent = [headers.join(','), sampleData.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'items_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setCsvData([]);
    setPreviewData([]);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
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
              {t('business.csvUpload.instructions')}
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

          {/* Preview */}
          {previewData.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('business.csvUpload.preview')} ({csvData.length}{' '}
                {t('business.csvUpload.items')})
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Size</TableCell>
                      <TableCell>Weight</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>
                          {item.price} {item.currency}
                        </TableCell>
                        <TableCell>{item.sku || '-'}</TableCell>
                        <TableCell>
                          {item.size && item.size_unit
                            ? `${item.size} ${item.size_unit}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {item.weight && item.weight_unit
                            ? `${item.weight} ${item.weight_unit}`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
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
          {uploading
            ? t('business.csvUpload.uploading')
            : t('business.csvUpload.upload')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
