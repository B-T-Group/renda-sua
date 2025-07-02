import {
  Add as AddIcon,
  Delete as DeleteIcon,
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
import { BusinessInventoryItem } from '../../hooks/useBusinessInventory';

interface BusinessInventoryTableProps {
  items: BusinessInventoryItem[];
  loading: boolean;
  onUpdateInventory: (item: BusinessInventoryItem) => void;
  onEditItem: (item: BusinessInventoryItem) => void;
  onDeleteItem: (item: BusinessInventoryItem) => void;
  onRestockItem: (item: BusinessInventoryItem) => void;
}

export default function BusinessInventoryTable({
  items,
  loading,
  onUpdateInventory,
  onEditItem,
  onDeleteItem,
  onRestockItem,
}: BusinessInventoryTableProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const handleViewItem = (item: BusinessInventoryItem) => {
    navigate(`/business/items/${item.item.id}`);
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

  const getStockStatus = (item: BusinessInventoryItem) => {
    if (item.available_quantity <= 0) {
      return { status: 'out_of_stock', color: 'error' as const };
    } else if (item.available_quantity <= item.reorder_point) {
      return { status: 'low_stock', color: 'warning' as const };
    } else {
      return { status: 'in_stock', color: 'success' as const };
    }
  };

  const getStockStatusText = (status: string) => {
    switch (status) {
      case 'out_of_stock':
        return t('business.inventory.outOfStock');
      case 'low_stock':
        return t('business.inventory.lowStock');
      case 'in_stock':
        return t('business.inventory.inStock');
      default:
        return t('business.inventory.unknown');
    }
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
                {t('business.inventory.location')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.quantity')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.availableQuantity')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.reservedQuantity')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.unitCost')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.sellingPrice')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.reorderPoint')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.stockStatus')}
              </TableCell>
              <TableCell
                sx={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}
              >
                {t('business.inventory.lastRestocked')}
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
              const stockStatus = getStockStatus(item);
              return (
                <TableRow
                  hover
                  key={item.id}
                  sx={{
                    '&:last-child td, &:last-child th': { border: 0 },
                    backgroundColor:
                      item.available_quantity <= item.reorder_point
                        ? '#fff3e0'
                        : 'inherit',
                  }}
                >
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {item.item.name}
                      </Typography>
                      {item.item.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 200,
                          }}
                        >
                          {item.item.description}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {item.business_location.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.business_location.location_type}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {item.quantity}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      fontWeight="bold"
                      color={
                        item.available_quantity <= item.reorder_point
                          ? 'warning.main'
                          : 'inherit'
                      }
                    >
                      {item.available_quantity}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {item.reserved_quantity}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatCurrency(item.unit_cost, 'USD')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {formatCurrency(item.selling_price, 'USD')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {item.reorder_point}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStockStatusText(stockStatus.status)}
                      color={stockStatus.color}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {item.last_restocked_at
                        ? formatDate(item.last_restocked_at)
                        : t('business.inventory.neverRestocked')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title={t('common.view')}>
                        <IconButton
                          size="small"
                          onClick={() => handleViewItem(item)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('business.inventory.updateInventory')}>
                        <IconButton
                          size="small"
                          onClick={() => onUpdateInventory(item)}
                        >
                          <InventoryIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('business.inventory.restock')}>
                        <IconButton
                          size="small"
                          onClick={() => onRestockItem(item)}
                        >
                          <AddIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('common.edit')}>
                        <IconButton
                          size="small"
                          onClick={() => onEditItem(item)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('common.delete')}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => onDeleteItem(item)}
                        >
                          <DeleteIcon />
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
        count={sortedItems.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
}
