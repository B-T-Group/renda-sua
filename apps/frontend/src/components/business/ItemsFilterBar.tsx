import {
  Close as CloseIcon,
  FilterList as FilterListIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Badge,
  Box,
  Button,
  Chip,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ItemsFilterState {
  searchText: string;
  statusFilter: string;
  categoryFilter: string;
  brandFilter: string;
  stockFilter: string;
}

interface ItemsFilterBarProps {
  filters: ItemsFilterState;
  onFiltersChange: (filters: ItemsFilterState) => void;
  categories: string[];
  brands: string[];
  totalItems: number;
  filteredItemsCount: number;
}

const ItemsFilterBar: React.FC<ItemsFilterBarProps> = ({
  filters,
  onFiltersChange,
  categories,
  brands,
  totalItems,
  filteredItemsCount,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleFilterChange = (field: keyof ItemsFilterState, value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value,
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      searchText: '',
      statusFilter: 'all',
      categoryFilter: 'all',
      brandFilter: 'all',
      stockFilter: 'all',
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.searchText) count++;
    if (filters.statusFilter !== 'all') count++;
    if (filters.categoryFilter !== 'all') count++;
    if (filters.brandFilter !== 'all') count++;
    if (filters.stockFilter !== 'all') count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  const getActiveFilterChips = () => {
    const chips: { label: string; onDelete: () => void }[] = [];

    if (filters.searchText) {
      chips.push({
        label: `${t('common.search', 'Search')}: "${filters.searchText}"`,
        onDelete: () => handleFilterChange('searchText', ''),
      });
    }

    if (filters.statusFilter !== 'all') {
      chips.push({
        label: `${t('business.items.status', 'Status')}: ${t(
          `business.items.${filters.statusFilter}`,
          filters.statusFilter
        )}`,
        onDelete: () => handleFilterChange('statusFilter', 'all'),
      });
    }

    if (filters.categoryFilter !== 'all') {
      chips.push({
        label: `${t('business.items.category', 'Category')}: ${
          filters.categoryFilter === '_no_category'
            ? t('business.items.filters.noCategory', 'No category')
            : filters.categoryFilter
        }`,
        onDelete: () => handleFilterChange('categoryFilter', 'all'),
      });
    }

    if (filters.brandFilter !== 'all') {
      chips.push({
        label: `${t('business.items.brand', 'Brand')}: ${
          filters.brandFilter === '_no_brand'
            ? t('business.items.filters.noBrand', 'No brand')
            : filters.brandFilter
        }`,
        onDelete: () => handleFilterChange('brandFilter', 'all'),
      });
    }

    if (filters.stockFilter !== 'all') {
      chips.push({
        label: `${t('business.inventory.stock', 'Stock')}: ${t(
          `business.inventory.status.${filters.stockFilter}`,
          filters.stockFilter
        )}`,
        onDelete: () => handleFilterChange('stockFilter', 'all'),
      });
    }

    return chips;
  };

  const inputSharpSx = { '& .MuiOutlinedInput-root': { borderRadius: 0 } };

  const FiltersContent = () => (
    <Stack spacing={2} sx={inputSharpSx}>
      {/* Search */}
      <TextField
        fullWidth
        placeholder={t(
          'business.items.filters.search',
          'Search by name, SKU, or description...'
        )}
        variant="outlined"
        size="small"
        value={filters.searchText}
        onChange={(e) => handleFilterChange('searchText', e.target.value)}
        InputProps={{
          startAdornment: (
            <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
          ),
        }}
      />

      {/* Status Filter */}
      <FormControl fullWidth size="small">
        <InputLabel>{t('business.items.filters.status', 'Status')}</InputLabel>
        <Select
          value={filters.statusFilter}
          onChange={(e) => handleFilterChange('statusFilter', e.target.value)}
          label={t('business.items.filters.status', 'Status')}
        >
          <MenuItem value="all">
            {t('business.items.filters.allStatuses', 'All Statuses')}
          </MenuItem>
          <MenuItem value="active">
            {t('business.items.active', 'Active')}
          </MenuItem>
          <MenuItem value="inactive">
            {t('business.items.inactive', 'Inactive')}
          </MenuItem>
        </Select>
      </FormControl>

      {/* Stock Filter */}
      <FormControl fullWidth size="small">
        <InputLabel>
          {t('business.inventory.stockStatus', 'Stock Status')}
        </InputLabel>
        <Select
          value={filters.stockFilter}
          onChange={(e) => handleFilterChange('stockFilter', e.target.value)}
          label={t('business.inventory.stockStatus', 'Stock Status')}
        >
          <MenuItem value="all">
            {t('business.inventory.allStock', 'All Stock Levels')}
          </MenuItem>
          <MenuItem value="inStock">
            {t('business.inventory.status.inStock', 'In Stock')}
          </MenuItem>
          <MenuItem value="lowStock">
            {t('business.inventory.status.lowStock', 'Low Stock')}
          </MenuItem>
          <MenuItem value="outOfStock">
            {t('business.inventory.status.outOfStock', 'Out of Stock')}
          </MenuItem>
          <MenuItem value="noInventory">
            {t('business.inventory.noInventory', 'No Inventory')}
          </MenuItem>
        </Select>
      </FormControl>

      {/* Category Filter */}
      <FormControl fullWidth size="small">
        <InputLabel>{t('business.items.category', 'Category')}</InputLabel>
        <Select
          value={filters.categoryFilter}
          onChange={(e) => handleFilterChange('categoryFilter', e.target.value)}
          label={t('business.items.category', 'Category')}
        >
          <MenuItem value="all">
            {t('business.items.filters.allCategories', 'All Categories')}
          </MenuItem>
          <MenuItem value="_no_category">
            {t('business.items.filters.noCategory', 'No category')}
          </MenuItem>
          {categories.map((category) => (
            <MenuItem key={category} value={category}>
              {category}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Brand Filter */}
      <FormControl fullWidth size="small">
        <InputLabel>{t('business.items.brand', 'Brand')}</InputLabel>
        <Select
          value={filters.brandFilter}
          onChange={(e) => handleFilterChange('brandFilter', e.target.value)}
          label={t('business.items.brand', 'Brand')}
        >
          <MenuItem value="all">
            {t('common.allBrands', 'All Brands')}
          </MenuItem>
          <MenuItem value="_no_brand">
            {t('business.items.filters.noBrand', 'No brand')}
          </MenuItem>
          {brands.map((brand) => (
            <MenuItem key={brand} value={brand}>
              {brand}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Clear Filters Button */}
      {activeFiltersCount > 0 && (
        <Button
          fullWidth
          variant="outlined"
          size="small"
          onClick={handleClearFilters}
        >
          {t('common.clearFilters', 'Clear All Filters')} ({activeFiltersCount})
        </Button>
      )}
    </Stack>
  );

  return (
    <Box>
      {/* Desktop Filters */}
      {!isMobile ? (
        <Paper
          sx={{
            p: 2,
            mb: 2,
            '& .MuiOutlinedInput-root': { borderRadius: 0 },
          }}
        >
          <Stack spacing={2}>
            {/* First Row - Search and Main Filters */}
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                placeholder={t(
                  'business.items.filters.search',
                  'Search by name, SKU, or description...'
                )}
                variant="outlined"
                size="small"
                value={filters.searchText}
                onChange={(e) =>
                  handleFilterChange('searchText', e.target.value)
                }
                sx={{ minWidth: 250, maxWidth: 400, flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  ),
                }}
              />

              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>
                  {t('business.items.filters.status', 'Status')}
                </InputLabel>
                <Select
                  value={filters.statusFilter}
                  onChange={(e) =>
                    handleFilterChange('statusFilter', e.target.value)
                  }
                  label={t('business.items.filters.status', 'Status')}
                >
                  <MenuItem value="all">
                    {t('business.items.filters.allStatuses', 'All Statuses')}
                  </MenuItem>
                  <MenuItem value="active">
                    {t('business.items.active', 'Active')}
                  </MenuItem>
                  <MenuItem value="inactive">
                    {t('business.items.inactive', 'Inactive')}
                  </MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>
                  {t('business.inventory.stockStatus', 'Stock Status')}
                </InputLabel>
                <Select
                  value={filters.stockFilter}
                  onChange={(e) =>
                    handleFilterChange('stockFilter', e.target.value)
                  }
                  label={t('business.inventory.stockStatus', 'Stock Status')}
                >
                  <MenuItem value="all">
                    {t('business.inventory.allStock', 'All Stock')}
                  </MenuItem>
                  <MenuItem value="inStock">
                    {t('business.inventory.status.inStock', 'In Stock')}
                  </MenuItem>
                  <MenuItem value="lowStock">
                    {t('business.inventory.status.lowStock', 'Low Stock')}
                  </MenuItem>
                  <MenuItem value="outOfStock">
                    {t('business.inventory.status.outOfStock', 'Out of Stock')}
                  </MenuItem>
                  <MenuItem value="noInventory">
                    {t('business.inventory.noInventory', 'No Inventory')}
                  </MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>
                  {t('business.items.category', 'Category')}
                </InputLabel>
                <Select
                  value={filters.categoryFilter}
                  onChange={(e) =>
                    handleFilterChange('categoryFilter', e.target.value)
                  }
                  label={t('business.items.category', 'Category')}
                >
                  <MenuItem value="all">
                    {t('business.items.filters.allCategories', 'All Categories')}
                  </MenuItem>
                  <MenuItem value="_no_category">
                    {t('business.items.filters.noCategory', 'No category')}
                  </MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>{t('business.items.brand', 'Brand')}</InputLabel>
                <Select
                  value={filters.brandFilter}
                  onChange={(e) =>
                    handleFilterChange('brandFilter', e.target.value)
                  }
                  label={t('business.items.brand', 'Brand')}
                >
                  <MenuItem value="all">
                    {t('common.allBrands', 'All Brands')}
                  </MenuItem>
                  <MenuItem value="_no_brand">
                    {t('business.items.filters.noBrand', 'No brand')}
                  </MenuItem>
                  {brands.map((brand) => (
                    <MenuItem key={brand} value={brand}>
                      {brand}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {activeFiltersCount > 0 && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleClearFilters}
                >
                  {t('common.clearFilters', 'Clear')}
                </Button>
              )}
            </Stack>

            {/* Second Row - Active Filters & Results Count */}
            {(activeFiltersCount > 0 || filteredItemsCount !== totalItems) && (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                sx={{ gap: 1 }}
              >
                {/* Active Filter Chips */}
                {getActiveFilterChips().map((chip, index) => (
                  <Chip
                    key={index}
                    label={chip.label}
                    size="small"
                    onDelete={chip.onDelete}
                    color="primary"
                    variant="outlined"
                  />
                ))}

                {/* Results Count */}
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ ml: 'auto' }}
                >
                  {t('common.showing', 'Showing')} {filteredItemsCount}{' '}
                  {t('common.of', 'of')} {totalItems}{' '}
                  {t('business.items.items', 'items')}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Paper>
      ) : (
        /* Mobile Filters */
        <>
          <Paper
            sx={{
              p: 2,
              mb: 2,
              '& .MuiOutlinedInput-root': { borderRadius: 0 },
            }}
          >
            <Stack spacing={2}>
              {/* Search Bar */}
              <TextField
                fullWidth
                placeholder={t(
                  'business.items.filters.search',
                  'Search items...'
                )}
                variant="outlined"
                size="small"
                value={filters.searchText}
                onChange={(e) =>
                  handleFilterChange('searchText', e.target.value)
                }
                InputProps={{
                  startAdornment: (
                    <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  ),
                }}
              />

              {/* Filter Button & Results */}
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Badge badgeContent={activeFiltersCount} color="primary">
                  <Button
                    variant="outlined"
                    startIcon={<FilterListIcon />}
                    onClick={() => setDrawerOpen(true)}
                    size="small"
                  >
                    {t('common.filters', 'Filters')}
                  </Button>
                </Badge>

                <Typography variant="body2" color="text.secondary">
                  {filteredItemsCount} {t('common.of', 'of')} {totalItems}
                </Typography>
              </Stack>

              {/* Active Filter Chips */}
              {activeFiltersCount > 0 && (
                <Stack
                  direction="row"
                  spacing={1}
                  flexWrap="wrap"
                  sx={{ gap: 1 }}
                >
                  {getActiveFilterChips().map((chip, index) => (
                    <Chip
                      key={index}
                      label={chip.label}
                      size="small"
                      onDelete={chip.onDelete}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>

          {/* Mobile Filter Drawer */}
          <Drawer
            anchor="bottom"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            PaperProps={{
              sx: {
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                maxHeight: '80vh',
              },
            }}
          >
            <Box sx={{ p: 3 }}>
              {/* Header */}
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 3 }}
              >
                <Typography variant="h6" fontWeight="bold">
                  {t('common.filters', 'Filters')}
                  {activeFiltersCount > 0 && ` (${activeFiltersCount})`}
                </Typography>
                <IconButton
                  onClick={() => setDrawerOpen(false)}
                  size="small"
                  aria-label="close"
                >
                  <CloseIcon />
                </IconButton>
              </Stack>

              {/* Filter Content */}
              <FiltersContent />

              {/* Apply Button */}
              <Button
                fullWidth
                variant="contained"
                onClick={() => setDrawerOpen(false)}
                sx={{ mt: 3 }}
              >
                {t('common.apply', 'Apply Filters')}
              </Button>
            </Box>
          </Drawer>
        </>
      )}
    </Box>
  );
};

export default ItemsFilterBar;
