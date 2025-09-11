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
import {
  AddInventoryItemData,
  useBusinessInventory,
} from '../../hooks/useBusinessInventory';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';
import { useItemImages } from '../../hooks/useItemImages';
import { useItems } from '../../hooks/useItems';
import { useProfile } from '../../hooks/useProfile';
import { ItemImage } from '../../types/image';

interface CSVUploadDialogProps {
  open: boolean;
  onClose: () => void;
  businessId: string;
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

interface CreateItemData {
  name: string;
  description: string;
  item_sub_category_id: number;
  price: number;
  currency: string;
  business_id: string;
  sku?: string;
  weight?: number;
  weight_unit?: string;
  color?: string;
  model?: string;
  is_fragile?: boolean;
  is_perishable?: boolean;
  requires_special_handling?: boolean;
  min_order_quantity?: number;
  max_order_quantity?: number;
  is_active?: boolean;
  brand_id?: string;
}

interface UpdateItemData {
  name?: string;
  description?: string;
  item_sub_category_id?: number;
  price?: number;
  currency?: string;
  sku?: string;
  weight?: number;
  weight_unit?: string;
  color?: string;
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
  const { addInventoryItem, updateInventoryItem, inventory } =
    useBusinessInventory(businessId);
  const { locations } = useBusinessLocations(businessId);
  const { uploadItemImage, createItemImage, fetchItemImages, deleteItemImage } =
    useItemImages();
  const { userProfile } = useProfile();

  const [csvData, setCsvData] = useState<CSVItemWithInventory[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [previewData, setPreviewData] = useState<CSVItemWithInventory[]>([]);
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

    if (!userProfile?.id) {
      enqueueSnackbar(t('business.inventory.userIdRequired'), {
        variant: 'error',
      });
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

    await handleUnifiedUpload(csvData, result);

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

  const handleUnifiedUpload = async (
    data: CSVItemWithInventory[],
    result: UploadResult
  ) => {
    const bucketName =
      process.env.REACT_APP_S3_BUCKET_NAME || 'rendasua-uploads';

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Step 1: Create or update the item
        const existingItem = items.find(
          (existing) =>
            existing.name.toLowerCase() === row.name.toLowerCase() ||
            (row.sku &&
              existing.sku &&
              existing.sku.toLowerCase() === row.sku.toLowerCase())
        );

        let itemId: string;
        if (existingItem) {
          // Check if this is a SKU conflict (different item with same SKU)
          const isSkuConflict =
            existingItem.name.toLowerCase() !== row.name.toLowerCase() &&
            row.sku &&
            existingItem.sku &&
            existingItem.sku.toLowerCase() === row.sku.toLowerCase();

          if (isSkuConflict) {
            throw new Error(
              `SKU "${row.sku}" is already used by item "${existingItem.name}". Cannot update item "${row.name}" with conflicting SKU.`
            );
          }

          // Update existing item - only pass item-specific fields, but skip SKU if it's different
          const updateItemData: UpdateItemData = {
            name: row.name,
            description: row.description || '',
            item_sub_category_id: row.item_sub_category_id || 1,
            price: row.price,
            currency: row.currency,
            // Only update SKU if it's the same or if the existing item has no SKU
            ...(row.sku === existingItem.sku || !existingItem.sku
              ? { sku: row.sku }
              : {}),
            weight: row.weight,
            weight_unit: row.weight_unit,
            color: row.color,
            model: row.model,
            is_fragile: row.is_fragile,
            is_perishable: row.is_perishable,
            requires_special_handling: row.requires_special_handling,
            min_order_quantity: row.min_order_quantity,
            max_order_quantity: row.max_order_quantity,
            is_active: row.is_active,
            brand_id: row.brand_id,
          };
          await updateItem(existingItem.id, updateItemData);
          result.details.updated.push(`Item: ${row.name}`);
          itemId = existingItem.id;
        } else {
          // Check if SKU already exists in the database
          const skuExists = items.some(
            (existing) =>
              row.sku &&
              existing.sku &&
              existing.sku.toLowerCase() === row.sku.toLowerCase()
          );

          if (skuExists) {
            throw new Error(
              `SKU "${row.sku}" already exists. Cannot create item "${row.name}" with duplicate SKU.`
            );
          }

          // Create new item
          const createData: CreateItemData = {
            name: row.name,
            description: row.description || '',
            item_sub_category_id: row.item_sub_category_id || 1,
            price: row.price,
            currency: row.currency,
            business_id: row.business_id,
            sku: row.sku,
            weight: row.weight,
            weight_unit: row.weight_unit,
            color: row.color,
            model: row.model,
            is_fragile: row.is_fragile,
            is_perishable: row.is_perishable,
            requires_special_handling: row.requires_special_handling,
            min_order_quantity: row.min_order_quantity,
            max_order_quantity: row.max_order_quantity,
            is_active: row.is_active,
            brand_id: row.brand_id,
          };
          const newItem = await createItem(createData);
          itemId = newItem.id;
          result.details.inserted.push(`Item: ${row.name}`);
        }

        // Step 2: Create or update inventory
        const location = locations.find(
          (existing) =>
            existing.name.toLowerCase() ===
            row.business_location_name.toLowerCase()
        );

        if (!location) {
          throw new Error(`Location "${row.business_location_name}" not found`);
        }

        const existingInventory = inventory.find(
          (existing) =>
            existing.item_id === itemId &&
            existing.business_location_id === location.id
        );

        const inventoryData: AddInventoryItemData = {
          business_location_id: location.id,
          item_id: itemId,
          quantity: row.quantity,
          reserved_quantity: row.reserved_quantity,
          reorder_point: row.reorder_point,
          reorder_quantity: row.reorder_quantity,
          unit_cost: row.unit_cost,
          selling_price: row.selling_price,
          is_active: row.is_active ?? true,
        };

        if (existingInventory) {
          await updateInventoryItem(existingInventory.id, inventoryData);
          result.details.updated.push(
            `Inventory: ${row.name} at ${row.business_location_name}`
          );
        } else {
          await addInventoryItem(inventoryData);
          result.details.inserted.push(
            `Inventory: ${row.name} at ${row.business_location_name}`
          );
        }

        // Step 3: Add image if provided
        if (row.image_url) {
          try {
            // Check if item already has a main image and delete it first
            const existingImages = await fetchItemImages(itemId);
            const existingMainImage = existingImages.find(
              (img: ItemImage) => img.image_type === 'main'
            );

            if (existingMainImage) {
              await deleteItemImage(existingMainImage.id);
            }

            // Create the image record with the provided URL
            const imageData = {
              item_id: itemId,
              image_url: row.image_url,
              image_type: 'main' as const,
              alt_text: row.image_alt_text || row.name,
              caption: row.image_caption,
              display_order: 1,
              uploaded_by: userProfile?.id || '',
            };

            await createItemImage(imageData);
            result.details.inserted.push(`Image: ${row.name}`);
          } catch (imageError) {
            console.error('Failed to add image:', imageError);
            // Don't fail the entire row for image errors
            result.details.errors.push({
              row: i + 2,
              error: `Image upload failed: ${
                imageError instanceof Error
                  ? imageError.message
                  : 'Unknown error'
              }`,
            });
          }
        }

        result.success++;
      } catch (error) {
        result.errors++;
        result.details.errors.push({
          row: i + 2, // +2 because of 0-based index and header row
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
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
      'business_location_name',
      'quantity',
      'reserved_quantity',
      'reorder_point',
      'reorder_quantity',
      'unit_cost',
      'selling_price',
      'image_url',
      'image_alt_text',
      'image_caption',
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
      'Main Warehouse',
      '100',
      '95',
      '5',
      '20',
      '50',
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
          {uploading
            ? t('business.csvUpload.uploading')
            : t('business.csvUpload.upload')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
