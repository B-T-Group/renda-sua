import { Box, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Item } from '../../hooks/useItems';
import InventoryTable from '../business/InventoryTable';

export default function InventoryTableExample() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  // Sample data for demonstration
  const sampleItems: Item[] = [
    {
      id: '1',
      name: 'Premium Coffee Beans',
      description: 'High-quality Arabica coffee beans',
      item_sub_category_id: 1,
      sku: 'COFFEE-001',
      price: 24.99,
      currency: 'USD',
      min_order_quantity: 1,
      max_order_quantity: 50,
      is_active: true,
      is_fragile: false,
      is_perishable: true,
      requires_special_handling: false,
      size: 500,
      size_unit: 'g',
      weight: 0.5,
      weight_unit: 'kg',
      color: 'Brown',

      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z',
      business_id: 'business-1',
      brand_id: 'brand-1',
      model: null,
      material: null,
      item_sub_category: {
        id: 1,
        name: 'Coffee',
        item_category: {
          id: 1,
          name: 'Beverages',
        },
      },
      brand: {
        id: 'brand-1',
        name: 'CoffeeCo',
        description: 'Premium coffee brand',
      },
    },
    {
      id: '2',
      name: 'Organic Tea Set',
      description: 'Elegant ceramic tea set with 6 cups',
      item_sub_category_id: 2,
      sku: 'TEA-002',
      price: 89.99,
      currency: 'USD',
      min_order_quantity: 1,
      max_order_quantity: 10,
      is_active: true,
      is_fragile: true,
      is_perishable: false,
      requires_special_handling: true,
      size: 30,
      size_unit: 'cm',
      weight: 2.5,
      weight_unit: 'kg',
      color: 'White',

      created_at: '2024-01-14T14:20:00Z',
      updated_at: '2024-01-14T14:20:00Z',
      business_id: 'business-1',
      brand_id: 'brand-2',
      model: null,
      material: null,
      item_sub_category: {
        id: 2,
        name: 'Tea Sets',
        item_category: {
          id: 1,
          name: 'Beverages',
        },
      },
      brand: {
        id: 'brand-2',
        name: 'TeaCraft',
        description: 'Artisan tea accessories',
      },
    },
    {
      id: '3',
      name: 'Fresh Pastries',
      description: 'Assorted fresh baked pastries',
      item_sub_category_id: 3,
      sku: 'PASTRY-003',
      price: 12.99,
      currency: 'USD',
      min_order_quantity: 6,
      max_order_quantity: 24,
      is_active: true,
      is_fragile: false,
      is_perishable: true,
      requires_special_handling: false,
      size: 15,
      size_unit: 'cm',
      weight: 0.3,
      weight_unit: 'kg',
      color: 'Golden',

      created_at: '2024-01-13T08:45:00Z',
      updated_at: '2024-01-13T08:45:00Z',
      business_id: 'business-1',
      brand_id: 'brand-3',
      model: null,
      material: null,
      item_sub_category: {
        id: 3,
        name: 'Pastries',
        item_category: {
          id: 2,
          name: 'Food',
        },
      },
      brand: {
        id: 'brand-3',
        name: 'BakeryFresh',
        description: 'Fresh baked goods',
      },
    },
  ];

  const handleUpdateInventory = (item: Item) => {
    console.log('Update inventory for:', item.name);
    // Handle inventory update logic
  };

  const handleEditItem = (item: Item) => {
    console.log('Edit item:', item.name);
    // Handle edit item logic
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('business.inventory.title')} - Table Example
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        This example demonstrates the new InventoryTable component with sample
        data. The table provides a clean, organized view of inventory items with
        pagination, sorting, and action buttons.
      </Typography>

      <InventoryTable
        items={sampleItems}
        loading={loading}
        onUpdateInventory={handleUpdateInventory}
        onEditItem={handleEditItem}
      />
    </Box>
  );
}
