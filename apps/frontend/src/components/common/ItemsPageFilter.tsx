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
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { InventoryItem } from '../../hooks/useInventoryItems';

export interface ItemsPageFilterState {
  category: string;
  subcategory: string;
  brand: string;
}

interface ItemsPageFilterProps {
  items: InventoryItem[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filters: ItemsPageFilterState;
  onFiltersChange: (filters: ItemsPageFilterState) => void;
  onFilterChange: (filteredItems: InventoryItem[]) => void;
  loading?: boolean;
}

const ItemsPageFilter: React.FC<ItemsPageFilterProps> = ({
  items,
  searchTerm,
  onSearchChange,
  filters,
  onFiltersChange,
  onFilterChange,
  loading = false,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const filterOptions = useMemo(() => {
    const categories = Array.from(
      new Set(
        items
          .map((item) => item.item.item_sub_category?.item_category?.name)
          .filter(Boolean) as string[]
      )
    ).sort();

    const subcategories = Array.from(
      new Set(
        items
          .filter(
            (item) =>
              !filters.category ||
              item.item.item_sub_category?.item_category?.name ===
                filters.category
          )
          .map((item) => item.item.item_sub_category?.name)
          .filter(Boolean) as string[]
      )
    ).sort();

    const brands = Array.from(
      new Set(
        items.map((item) => item.item.brand?.name).filter(Boolean) as string[]
      )
    ).sort();

    return { categories, subcategories, brands };
  }, [items, filters.category]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          item.item.name.toLowerCase().includes(term) ||
          item.item.description?.toLowerCase().includes(term) ||
          item.item.brand?.name?.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      if (
        filters.category &&
        item.item.item_sub_category?.item_category?.name !== filters.category
      ) {
        return false;
      }

      if (
        filters.subcategory &&
        item.item.item_sub_category?.name !== filters.subcategory
      ) {
        return false;
      }

      if (filters.brand && item.item.brand?.name !== filters.brand) {
        return false;
      }

      return true;
    });
  }, [items, searchTerm, filters]);

  useEffect(() => {
    onFilterChange(filteredItems);
  }, [filteredItems, onFilterChange]);

  const handleFilterChange = (field: keyof ItemsPageFilterState, value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value,
      ...(field === 'category' ? { subcategory: '' } : {}),
    });
  };

  const handleClearFilters = () => {
    onSearchChange('');
    onFiltersChange({
      category: '',
      subcategory: '',
      brand: '',
    });
  };

  const activeFiltersCount = [
    searchTerm,
    filters.category,
    filters.subcategory,
    filters.brand,
  ].filter(Boolean).length;

  const getActiveFilterChips = () => {
    const chips: { label: string; onDelete: () => void }[] = [];
    if (searchTerm) {
      chips.push({
        label: `${t('common.search', 'Search')}: "${searchTerm}"`,
        onDelete: () => onSearchChange(''),
      });
    }
    if (filters.category) {
      chips.push({
        label: `${t('common.category', 'Category')}: ${filters.category}`,
        onDelete: () => handleFilterChange('category', ''),
      });
    }
    if (filters.subcategory) {
      chips.push({
        label: `${t('common.subcategory', 'Subcategory')}: ${filters.subcategory}`,
        onDelete: () => handleFilterChange('subcategory', ''),
      });
    }
    if (filters.brand) {
      chips.push({
        label: `${t('common.brand', 'Brand')}: ${filters.brand}`,
        onDelete: () => handleFilterChange('brand', ''),
      });
    }
    return chips;
  };

  const FiltersContent = () => (
    <Stack spacing={2}>
      <FormControl fullWidth size="small">
        <InputLabel>{t('common.category', 'Category')}</InputLabel>
        <Select
          value={filters.category}
          onChange={(e) => handleFilterChange('category', e.target.value)}
          label={t('common.category', 'Category')}
        >
          <MenuItem value="">{t('common.all', 'All')}</MenuItem>
          {filterOptions.categories.map((cat) => (
            <MenuItem key={cat} value={cat}>
              {cat}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth size="small">
        <InputLabel>{t('common.subcategory', 'Subcategory')}</InputLabel>
        <Select
          value={filters.subcategory}
          onChange={(e) => handleFilterChange('subcategory', e.target.value)}
          label={t('common.subcategory', 'Subcategory')}
          disabled={!filters.category}
        >
          <MenuItem value="">{t('common.all', 'All')}</MenuItem>
          {filterOptions.subcategories.map((sub) => (
            <MenuItem key={sub} value={sub}>
              {sub}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth size="small">
        <InputLabel>{t('common.brand', 'Brand')}</InputLabel>
        <Select
          value={filters.brand}
          onChange={(e) => handleFilterChange('brand', e.target.value)}
          label={t('common.brand', 'Brand')}
        >
          <MenuItem value="">{t('common.all', 'All')}</MenuItem>
          {filterOptions.brands.map((b) => (
            <MenuItem key={b} value={b}>
              {b}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {activeFiltersCount > 0 && (
        <Button
          fullWidth
          variant="outlined"
          size="small"
          onClick={handleClearFilters}
        >
          {t('common.clear', 'Clear All Filters')} ({activeFiltersCount})
        </Button>
      )}
    </Stack>
  );

  if (loading) {
    return (
      <Box sx={{ mb: 3 }}>
        <Stack spacing={2} alignItems="center">
          <Skeleton
            variant="rectangular"
            height={56}
            sx={{ width: '100%', maxWidth: 400, borderRadius: 1 }}
          />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Skeleton variant="rectangular" width={120} height={56} />
            <Skeleton variant="rectangular" width={140} height={56} />
            <Skeleton variant="rectangular" width={100} height={56} />
          </Box>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 3 }}>
      {/* Search bar - centered */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          mb: 2,
        }}
      >
        <TextField
          fullWidth
          placeholder={t('public.items.searchPlaceholder', 'Search items...')}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{
            maxWidth: 400,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            },
          }}
        />
      </Box>

      {!isMobile ? (
        /* Desktop: inline filters */
        <Box>
          <Grid container sx={{ width: '100%' }} spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('common.category', 'Category')}</InputLabel>
                <Select
                  value={filters.category}
                  onChange={(e) =>
                    handleFilterChange('category', e.target.value)
                  }
                  label={t('common.category', 'Category')}
                >
                  <MenuItem value="">{t('common.all', 'All')}</MenuItem>
                  {filterOptions.categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {t('common.subcategory', 'Subcategory')}
                </InputLabel>
                <Select
                  value={filters.subcategory}
                  onChange={(e) =>
                    handleFilterChange('subcategory', e.target.value)
                  }
                  label={t('common.subcategory', 'Subcategory')}
                  disabled={!filters.category}
                >
                  <MenuItem value="">{t('common.all', 'All')}</MenuItem>
                  {filterOptions.subcategories.map((sub) => (
                    <MenuItem key={sub} value={sub}>
                      {sub}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('common.brand', 'Brand')}</InputLabel>
                <Select
                  value={filters.brand}
                  onChange={(e) =>
                    handleFilterChange('brand', e.target.value)
                  }
                  label={t('common.brand', 'Brand')}
                >
                  <MenuItem value="">{t('common.all', 'All')}</MenuItem>
                  {filterOptions.brands.map((b) => (
                    <MenuItem key={b} value={b}>
                      {b}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {(activeFiltersCount > 0 || filteredItems.length !== items.length) && (
            <Stack
              direction="row"
              alignItems="center"
              flexWrap="wrap"
              sx={{ gap: 1, mt: 2 }}
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
              {activeFiltersCount > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleClearFilters}
                >
                  {t('common.clear', 'Clear')}
                </Button>
              )}
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ ml: 'auto' }}
              >
                {t('common.showing', 'Showing')} {filteredItems.length}{' '}
                {t('common.of', 'of')} {items.length} {t('common.items', 'items')}
              </Typography>
            </Stack>
          )}
        </Box>
      ) : (
        /* Mobile: filter button + drawer */
        <>
          <Stack spacing={2}>
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
                  size="medium"
                  fullWidth
                  sx={{ minHeight: 44 }}
                >
                  {t('common.filters', 'Filters')}
                </Button>
              </Badge>

              <Typography variant="body2" color="text.secondary">
                {filteredItems.length} {t('common.of', 'of')} {items.length}
              </Typography>
            </Stack>

            {activeFiltersCount > 0 && (
              <Stack direction="row" flexWrap="wrap" sx={{ gap: 1 }}>
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

              <FiltersContent />

              <Button
                fullWidth
                variant="contained"
                onClick={() => setDrawerOpen(false)}
                sx={{ mt: 3, minHeight: 44 }}
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

export default ItemsPageFilter;
