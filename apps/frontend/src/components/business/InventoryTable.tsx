import {
  Edit as EditIcon,
  Inventory as InventoryIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Item } from '../../hooks/useItems';

interface InventoryTableProps {
  items: Item[];
  loading: boolean;
  onUpdateInventory: (item: Item) => void;
  onEditItem: (item: Item) => void;
}

export default function InventoryTable({
  items,
  loading,
  onUpdateInventory,
  onEditItem,
}: InventoryTableProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const handleViewItem = (item: Item) => {
    navigate(`/business/items/${item.id}`);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getPhysicalProperties = (item: Item) => {
    const properties = [];

    if (item.size) {
      properties.push(`${item.size}${item.size_unit || ''}`);
    }
    if (item.weight) {
      properties.push(`${item.weight}${item.weight_unit || ''}`);
    }
    if (item.color) {
      properties.push(item.color);
    }

    return properties;
  };

  const getSpecialProperties = (item: Item) => {
    const properties = [];

    if (item.is_fragile) {
      properties.push(t('business.inventory.isFragile'));
    }
    if (item.is_perishable) {
      properties.push(t('business.inventory.isPerishable'));
    }
    if (item.requires_special_handling) {
      properties.push(t('business.inventory.requiresSpecialHandling'));
    }

    return properties;
  };

  const getDeliveryProperties = (item: Item) => {
    const properties = [];

    return properties;
  };

  // Sort items by created_at descending
  const sortedItems = [...items].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const paginatedItems = sortedItems.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      <TableContainer sx={{ maxHeight: 600 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.itemName')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.category')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.brand')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.price')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.physicalProperties')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.specialProperties')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.orderQuantities')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.deliveryProperties')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.stockStatus')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.createdAt')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('common.actions')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedItems.map((item) => {
              const physicalProperties = getPhysicalProperties(item);
              const specialProperties = getSpecialProperties(item);
              const deliveryProperties = getDeliveryProperties(item);

              return (
                <TableRow
                  key={item.id}
                  hover
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  {/* Item Name & SKU */}
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="body2" fontWeight="medium">
                        {item.name}
                      </Typography>
                      {item.sku && (
                        <Typography variant="caption" color="text.secondary">
                          SKU: {item.sku}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>

                  {/* Category */}
                  <TableCell>
                    <Typography variant="body2">
                      {item.item_sub_category?.item_category
                        ? `${item.item_sub_category.item_category.name} - ${item.item_sub_category.name}`
                        : item.item_sub_category?.name || ''}
                    </Typography>
                  </TableCell>

                  {/* Brand */}
                  <TableCell>
                    <Typography variant="body2">
                      {item.brand?.name || t('business.inventory.noBrand')}
                    </Typography>
                  </TableCell>

                  {/* Price */}
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {formatCurrency(item.price, item.currency)}
                    </Typography>
                  </TableCell>

                  {/* Physical Properties */}
                  <TableCell>
                    <Stack spacing={0.5}>
                      {physicalProperties.length > 0 ? (
                        physicalProperties.map((prop, index) => (
                          <Typography
                            key={index}
                            variant="caption"
                            color="text.secondary"
                          >
                            {prop}
                          </Typography>
                        ))
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {t('business.inventory.noProperties')}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>

                  {/* Special Properties */}
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {specialProperties.length > 0 ? (
                        specialProperties.map((prop, index) => (
                          <Chip
                            key={index}
                            label={prop}
                            size="small"
                            variant="outlined"
                            color="warning"
                          />
                        ))
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {t('business.inventory.noSpecialProperties')}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>

                  {/* Order Quantities */}
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        Min: {item.min_order_quantity}
                      </Typography>
                      {item.max_order_quantity && (
                        <Typography variant="caption" color="text.secondary">
                          Max: {item.max_order_quantity}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>

                  {/* Delivery Properties */}
                  <TableCell>
                    <Stack spacing={0.5}>
                      {deliveryProperties.length > 0 ? (
                        deliveryProperties.map((prop, index) => (
                          <Typography
                            key={index}
                            variant="caption"
                            color="text.secondary"
                          >
                            {prop}
                          </Typography>
                        ))
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {t('business.inventory.noDeliveryProperties')}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Chip
                      label={
                        item.is_active
                          ? t('business.inventory.active')
                          : t('business.inventory.inactive')
                      }
                      color={item.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>

                  {/* Created At */}
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(item.created_at)}
                    </Typography>
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title={t('business.inventory.viewItem')}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleViewItem(item)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title={t('business.inventory.updateInventory')}>
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => onUpdateInventory(item)}
                        >
                          <InventoryIcon />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title={t('business.inventory.editItemButton')}>
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => onEditItem(item)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={items.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage={t('common.rowsPerPage')}
        labelDisplayedRows={({ from, to, count }) =>
          `${from}-${to} ${t('common.of')} ${
            count !== -1 ? count : `${t('common.moreThan')} ${to}`
          }`
        }
      />
    </Paper>
  );
}
