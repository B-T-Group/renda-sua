import {
  Clear as ClearIcon,
  FilterList as FilterListIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
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
  const [filters, setFilters] = useState<ItemsFilterState>({
    business: '',
    businessLocation: '',
    priceRange: [0, 1000],
    category: '',
    subcategory: '',
    itemName: '',
  });

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

  const handleFilterChange = (field: keyof ItemsFilterState, value: any) => {
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
      priceRange: filterOptions.priceRange,
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
    <Paper sx={{ p: 2, mb: 3 }} className={className}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <FilterListIcon color="primary" />
        <Typography variant="h6">{t('common.filters')}</Typography>
        {hasActiveFilters && (
          <Button
            size="small"
            startIcon={<ClearIcon />}
            onClick={handleClearFilters}
            variant="outlined"
            color="secondary"
          >
            {t('common.clear')}
          </Button>
        )}
      </Box>

      {loading ? (
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Skeleton variant="rectangular" width={200} height={56} />
            <Skeleton variant="rectangular" width={200} height={56} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Skeleton variant="rectangular" width={200} height={56} />
            <Skeleton variant="rectangular" width={200} height={56} />
          </Box>
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <Skeleton variant="rectangular" width={250} height={56} />
            <Skeleton variant="rectangular" width={300} height={80} />
          </Box>
          <Skeleton variant="text" width={200} />
        </Stack>
      ) : (
        <Stack spacing={2}>
          {/* First row - Business and Location */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>{t('common.business')}</InputLabel>
              <Select
                value={filters.business}
                onChange={(e) => handleFilterChange('business', e.target.value)}
                label={t('common.business')}
              >
                <MenuItem value="">{t('common.all')}</MenuItem>
                {filterOptions.businesses.map((business) => (
                  <MenuItem key={business} value={business}>
                    {business}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>{t('common.location')}</InputLabel>
              <Select
                value={filters.businessLocation}
                onChange={(e) =>
                  handleFilterChange('businessLocation', e.target.value)
                }
                label={t('common.location')}
                disabled={!filters.business}
              >
                <MenuItem value="">{t('common.all')}</MenuItem>
                {filterOptions.businessLocations.map((location) => (
                  <MenuItem key={location} value={location}>
                    {location}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Second row - Category and Subcategory */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>{t('common.category')}</InputLabel>
              <Select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                label={t('common.category')}
              >
                <MenuItem value="">{t('common.all')}</MenuItem>
                {filterOptions.categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>{t('common.subcategory')}</InputLabel>
              <Select
                value={filters.subcategory}
                onChange={(e) =>
                  handleFilterChange('subcategory', e.target.value)
                }
                label={t('common.subcategory')}
                disabled={!filters.category}
              >
                <MenuItem value="">{t('common.all')}</MenuItem>
                {filterOptions.subcategories.map((subcategory) => (
                  <MenuItem key={subcategory} value={subcategory}>
                    {subcategory}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Third row - Item name search and price range */}
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <TextField
              size="small"
              label={t('common.search')}
              placeholder={t('common.searchItems')}
              value={filters.itemName}
              onChange={(e) => handleFilterChange('itemName', e.target.value)}
              InputProps={{
                startAdornment: (
                  <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                ),
              }}
              sx={{ minWidth: 250 }}
            />

            <Box sx={{ minWidth: 300 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t('common.priceRange')}: ${filters.priceRange[0]} - $
                {filters.priceRange[1]}
              </Typography>
              <Slider
                value={filters.priceRange}
                onChange={(_, value) => handleFilterChange('priceRange', value)}
                valueLabelDisplay="auto"
                min={filterOptions.priceRange[0]}
                max={filterOptions.priceRange[1]}
                step={1}
              />
            </Box>
          </Box>

          {/* Results count */}
          <Typography variant="body2" color="text.secondary">
            {t('common.showing')} {filteredItems.length} {t('common.of')}{' '}
            {items.length} {t('common.items')}
          </Typography>
        </Stack>
      )}
    </Paper>
  );
};

export default ItemsFilter;
