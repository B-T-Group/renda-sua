import { Edit as EditIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useEditItemFlow } from '../../hooks/useEditItemFlow';
import EditItemDialog from '../business/EditItemDialog';

// Mock item for demonstration
const mockItem = {
  id: '1',
  name: 'Sample Product',
  description: 'This is a sample product for demonstration purposes.',
  item_sub_category_id: 1,
  weight: 500,
  weight_unit: 'g',
  price: 29.99,
  currency: 'USD',
  sku: 'SAMPLE-001',
  brand_id: '1',
  model: 'Model X',
  color: 'Black',
  is_fragile: false,
  is_perishable: false,
  requires_special_handling: false,

  min_order_quantity: 1,
  max_order_quantity: 10,
  is_active: true,
  business_id: 'business-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  brand: {
    id: '1',
    name: 'Sample Brand',
    description: 'A sample brand',
  },
  item_sub_category: {
    id: 1,
    name: 'Electronics',
    item_category: {
      id: 1,
      name: 'Technology',
    },
  },
};

const EditItemFlowExample: React.FC = () => {
  const { t } = useTranslation();
  const {
    isOpen,
    editingItem,
    isLoading,
    isSaving,
    error,
    openEditDialog,
    closeEditDialog,
    saveItem,
  } = useEditItemFlow('business-1');

  const handleEditItem = () => {
    openEditDialog(mockItem);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Edit Item Flow Example
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Sample Item
          </Typography>

          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">
                {mockItem.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {mockItem.description}
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">
                SKU: {mockItem.sku}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Brand: {mockItem.brand?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Category: {mockItem.item_sub_category?.item_category?.name} -{' '}
                {mockItem.item_sub_category?.name}
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" color="primary">
                {formatCurrency(mockItem.price, mockItem.currency)}
              </Typography>
            </Box>

            <Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {mockItem.weight && (
                  <Chip
                    label={`Weight: ${mockItem.weight} ${mockItem.weight_unit}`}
                    size="small"
                    variant="outlined"
                  />
                )}
                {mockItem.color && (
                  <Chip
                    label={`Color: ${mockItem.color}`}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Stack>
            </Box>

            <Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  label={`Min Order: ${mockItem.min_order_quantity}`}
                  size="small"
                  variant="outlined"
                />
                {mockItem.max_order_quantity && (
                  <Chip
                    label={`Max Order: ${mockItem.max_order_quantity}`}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Stack>
            </Box>

            <Box>
              <Chip
                label={mockItem.is_active ? 'Active' : 'Inactive'}
                color={mockItem.is_active ? 'success' : 'default'}
                size="small"
              />
            </Box>
          </Stack>

          <Box sx={{ mt: 3 }}>
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={handleEditItem}
              disabled={isLoading}
            >
              Edit Item
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Features Demonstrated
          </Typography>
          <Stack spacing={1}>
            <Typography variant="body2">
              • Enhanced form validation with real-time error feedback
            </Typography>
            <Typography variant="body2">
              • Improved UI with section dividers and better organization
            </Typography>
            <Typography variant="body2">
              • Loading states and progress indicators
            </Typography>
            <Typography variant="body2">
              • Comprehensive error handling and user feedback
            </Typography>
            <Typography variant="body2">
              • Reusable edit item flow hook
            </Typography>
            <Typography variant="body2">
              • Image management integration
            </Typography>
            <Typography variant="body2">• Multi-language support</Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Edit Item Dialog */}
      <EditItemDialog
        open={isOpen}
        onClose={closeEditDialog}
        item={editingItem}
        businessId="business-1"
      />
    </Box>
  );
};

export default EditItemFlowExample;
