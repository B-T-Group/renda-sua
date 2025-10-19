import {
  Clear as ClearIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Slider,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InventoryItem } from '../../hooks/useInventoryItems';

export interface ItemsFilterState {
  business: string;
  businessLocation: string;
  priceRange: [number, number];
  category: string;
  subcategory: string;
  itemName: string;
}

interface ItemsFilterProps {
  items: InventoryItem[];
  onFilterChange: (filteredItems: InventoryItem[]) => void;
  className?: string;
  loading?: boolean;
}

const ItemsFilter: React.FC<ItemsFilterProps> = ({
  items,
  onFilterChange,
  className,
  loading = false,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [filters, setFilters] = useState<ItemsFilterState>({
    business: '',
    businessLocation: '',
    priceRange: [0, 1000],
    category: '',
    subcategory: '',
    itemName: '',
  });

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Extract unique values for filter options
  const filterOptions = useMemo(() => {
    const businesses = Array.from(
      new Set(items.map((item) => item.business_location.business.name))
    ).sort();

    const businessLocations = Array.from(
      new Set(
        items
          .filter(
            (item) =>
              !filters.business ||
              item.business_location.business.name === filters.business
          )
          .map((item) => item.business_location.name)
      )
    ).sort();

    const categories = Array.from(
      new Set(
        items
          .map((item) => item.item.item_sub_category?.item_category?.name)
          .filter(Boolean)
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
          .filter(Boolean)
      )
    ).sort();

    const maxPrice = Math.max(...items.map((item) => item.selling_price), 1000);
    const minPrice = Math.min(...items.map((item) => item.selling_price), 0);

    return {
      businesses,
      businessLocations,
      categories,
      subcategories,
      priceRange: [minPrice, maxPrice],
    };
  }, [items, filters.business, filters.category]);

  // Apply filters to items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Business filter
      if (
        filters.business &&
        item.business_location.business.name !== filters.business
      ) {
        return false;
      }

      // Business location filter
      if (
        filters.businessLocation &&
        item.business_location.name !== filters.businessLocation
      ) {
        return false;
      }

      // Price range filter
      if (
        item.selling_price < filters.priceRange[0] ||
        item.selling_price > filters.priceRange[1]
      ) {
        return false;
      }

      // Category filter
      if (
        filters.category &&
        item.item.item_sub_category?.item_category?.name !== filters.category
      ) {
        return false;
      }

      // Subcategory filter
      if (
        filters.subcategory &&
        item.item.item_sub_category?.name !== filters.subcategory
      ) {
        return false;
      }

      // Item name filter
      if (
        filters.itemName &&
        !item.item.name.toLowerCase().includes(filters.itemName.toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  }, [items, filters]);

  // Update parent component when filtered items change
  React.useEffect(() => {
    onFilterChange(filteredItems);
  }, [filteredItems, onFilterChange]);

  const handleFilterChange = (
    field: keyof ItemsFilterState,
    value: string | [number, number]
  ) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [field]: value };

      // Reset dependent filters
      if (field === 'business') {
        newFilters.businessLocation = '';
      }
      if (field === 'category') {
        newFilters.subcategory = '';
      }

      return newFilters;
    });
  };

  const handleClearFilters = () => {
    setFilters({
      business: '',
      businessLocation: '',
      priceRange: [
        filterOptions.priceRange[0],
        filterOptions.priceRange[1],
      ] as [number, number],
      category: '',
      subcategory: '',
      itemName: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some((value) => {
    if (Array.isArray(value)) {
      return (
        value[0] !== filterOptions.priceRange[0] ||
        value[1] !== filterOptions.priceRange[1]
      );
    }
    return value !== '';
  });

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        overflow: 'hidden',
        mb: 3,
        className,
      }}
    >
      {loading ? (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Skeleton
                variant="rectangular"
                width={isMobile ? '100%' : 200}
                height={56}
              />
              <Skeleton
                variant="rectangular"
                width={isMobile ? '100%' : 200}
                height={56}
              />
            </Box>
            <Skeleton variant="rectangular" width="100%" height={56} />
            <Skeleton variant="rectangular" width="100%" height={80} />
          </Stack>
        </Box>
      ) : (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          {/* Header with Search and Quick Actions */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TuneIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {t('common.filters', 'Filters')}
              </Typography>
              {hasActiveFilters && (
                <Chip
                  label={
                    Object.values(filters).filter((v) =>
                      Array.isArray(v)
                        ? v[0] !== filterOptions.priceRange[0] ||
                          v[1] !== filterOptions.priceRange[1]
                        : v !== ''
                    ).length
                  }
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {hasActiveFilters && (
                <Button
                  size="small"
                  startIcon={<ClearIcon />}
                  onClick={handleClearFilters}
                  variant="outlined"
                  color="secondary"
                  sx={{ minWidth: 'auto' }}
                >
                  {t('common.clear', 'Clear')}
                </Button>
              )}

              {isMobile && (
                <Button
                  size="small"
                  endIcon={
                    showAdvancedFilters ? (
                      <ExpandLessIcon />
                    ) : (
                      <ExpandMoreIcon />
                    )
                  }
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  variant="outlined"
                >
                  {t('common.more', 'More')}
                </Button>
              )}
            </Box>
          </Box>

          {/* Main Search Bar */}
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size="medium"
              label={t('common.searchItems', 'Search items...')}
              placeholder={t(
                'common.searchPlaceholder',
                'Search by name, category, or business'
              )}
              value={filters.itemName}
              onChange={(e) => handleFilterChange('itemName', e.target.value)}
              InputProps={{
                startAdornment: (
                  <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: theme.palette.background.paper,
                },
              }}
            />
          </Box>

          {/* Advanced Filters */}
          <Collapse in={!isMobile || showAdvancedFilters}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(4, 1fr)',
                },
                gap: 2,
              }}
            >
              {/* Business and Location */}
              <FormControl fullWidth size="small">
                <InputLabel>{t('common.business', 'Business')}</InputLabel>
                <Select
                  value={filters.business}
                  onChange={(e) =>
                    handleFilterChange('business', e.target.value)
                  }
                  label={t('common.business', 'Business')}
                >
                  <MenuItem value="">{t('common.all', 'All')}</MenuItem>
                  {filterOptions.businesses.map((business) => (
                    <MenuItem key={business} value={business}>
                      {business}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>{t('common.location', 'Location')}</InputLabel>
                <Select
                  value={filters.businessLocation}
                  onChange={(e) =>
                    handleFilterChange('businessLocation', e.target.value)
                  }
                  label={t('common.location', 'Location')}
                  disabled={!filters.business}
                >
                  <MenuItem value="">{t('common.all', 'All')}</MenuItem>
                  {filterOptions.businessLocations.map((location) => (
                    <MenuItem key={location} value={location}>
                      {location}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Category and Subcategory */}
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
                  {filterOptions.categories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

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
                  {filterOptions.subcategories.map((subcategory) => (
                    <MenuItem key={subcategory} value={subcategory}>
                      {subcategory}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Price Range */}
            <Box sx={{ mt: 3 }}>
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{ fontWeight: 600 }}
              >
                {t('common.priceRange', 'Price Range')}
              </Typography>
              <Box sx={{ px: 1 }}>
                <Slider
                  value={filters.priceRange}
                  onChange={(_, value) =>
                    handleFilterChange('priceRange', value as [number, number])
                  }
                  valueLabelDisplay="auto"
                  min={filterOptions.priceRange[0]}
                  max={filterOptions.priceRange[1]}
                  step={1}
                  valueLabelFormat={(value) => `$${value}`}
                  sx={{
                    '& .MuiSlider-thumb': {
                      height: 20,
                      width: 20,
                    },
                    '& .MuiSlider-track': {
                      height: 6,
                    },
                    '& .MuiSlider-rail': {
                      height: 6,
                    },
                  }}
                />
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mt: 1,
                    px: 1,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    ${filters.priceRange[0]}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ${filters.priceRange[1]}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Collapse>

          {/* Results Summary */}
          <Box
            sx={{
              mt: 2,
              pt: 2,
              borderTop: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {t('common.showing', 'Showing')}{' '}
              <strong>{filteredItems.length}</strong> {t('common.of', 'of')}{' '}
              <strong>{items.length}</strong> {t('common.items', 'items')}
            </Typography>

            {hasActiveFilters && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {filters.business && (
                  <Chip
                    label={`Business: ${filters.business}`}
                    size="small"
                    onDelete={() => handleFilterChange('business', '')}
                    variant="outlined"
                  />
                )}
                {filters.category && (
                  <Chip
                    label={`Category: ${filters.category}`}
                    size="small"
                    onDelete={() => handleFilterChange('category', '')}
                    variant="outlined"
                  />
                )}
                {filters.itemName && (
                  <Chip
                    label={`Search: ${filters.itemName}`}
                    size="small"
                    onDelete={() => handleFilterChange('itemName', '')}
                    variant="outlined"
                  />
                )}
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default ItemsFilter;
