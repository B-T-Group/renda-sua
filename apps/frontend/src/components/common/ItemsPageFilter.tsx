import {
    Close as CloseIcon,
    CategoryOutlined as CategoryIcon,
    FilterList as FilterListIcon,
    Search as SearchIcon,
    StorefrontOutlined as StorefrontIcon,
} from '@mui/icons-material';
import {
    Autocomplete,
    Avatar,
    Badge,
    Box,
    Button,
    Chip,
    CircularProgress,
    Drawer,
    FormControl,
    Grid,
    IconButton,
    InputAdornment,
    InputLabel,
    ListItemAvatar,
    ListItemText,
    MenuItem,
    Select,
    Skeleton,
    Stack,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  InventorySearchSuggestion,
  useInventorySearchSuggestions,
} from '../../hooks/useInventorySearchSuggestions';
import {
  SITE_EVENT_INVENTORY_FILTER_CHANGE,
  SITE_EVENT_INVENTORY_FILTER_CLEAR,
  SITE_EVENT_INVENTORY_SEARCH_SUBMIT,
  SITE_EVENT_INVENTORY_SEARCH_SUGGESTION_SELECT,
  useTrackSiteEvent,
} from '../../hooks/useTrackSiteEvent';
import { InventoryItem } from '../../hooks/useInventoryItems';

export interface ItemsPageFilterState {
  category: string;
  subcategory: string;
  brand: string;
  /** Business location display name (`business_location.name`) */
  location: string;
}

interface ItemsPageFilterProps {
  items: InventoryItem[];
  searchTerm: string;
  /** Persists the committed query (e.g. URL `search` param) when the user submits. */
  onSearchSubmit: (value: string) => void;
  suggestionsQuery?: {
    include_unavailable?: boolean;
    is_active?: boolean;
    country_code?: string;
    state?: string;
    business_location_id?: string;
    origin_lat?: number;
    origin_lng?: number;
  };
  filters: ItemsPageFilterState;
  onFiltersChange: (filters: ItemsPageFilterState) => void;
  onFilterChange: (filteredItems: InventoryItem[]) => void;
  loading?: boolean;
  /** When the location dropdown changes (e.g. cleared), sync backend location filter. */
  onLocationFilterChange?: (locationName: string) => void;
  /** Called when user clears all filters from this panel. */
  onClearFilters?: () => void;
}

const ItemsPageFilter: React.FC<ItemsPageFilterProps> = ({
  items,
  searchTerm,
  onSearchSubmit,
  suggestionsQuery,
  filters,
  onFiltersChange,
  onFilterChange,
  loading = false,
  onLocationFilterChange,
  onClearFilters,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { trackSiteEvent } = useTrackSiteEvent();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [searchDraft, setSearchDraft] = React.useState(searchTerm);

  useEffect(() => {
    setSearchDraft(searchTerm);
  }, [searchTerm]);

  const runSearch = React.useCallback(() => {
    onSearchSubmit(searchDraft.trim());
    void trackSiteEvent({
      eventType: SITE_EVENT_INVENTORY_SEARCH_SUBMIT,
      metadata: { q: searchDraft.trim() || null },
    });
  }, [onSearchSubmit, searchDraft]);

  const { suggestions, loading: suggestionsLoading } =
    useInventorySearchSuggestions(
      {
        q: searchDraft,
        include_unavailable: suggestionsQuery?.include_unavailable,
        is_active: suggestionsQuery?.is_active,
        country_code: suggestionsQuery?.country_code,
        state: suggestionsQuery?.state,
        business_location_id: suggestionsQuery?.business_location_id,
        origin_lat: suggestionsQuery?.origin_lat,
        origin_lng: suggestionsQuery?.origin_lng,
      },
      { enabled: Boolean(suggestionsQuery) }
    );

  const suggestionsGroupLabel = React.useCallback(
    (kind: InventorySearchSuggestion['kind']) => {
      switch (kind) {
        case 'product':
          return t('public.items.suggestions.products', 'Products');
        case 'category':
          return t('public.items.suggestions.categories', 'Categories');
        case 'seller':
          return t('public.items.suggestions.sellers', 'Sellers');
        case 'term':
        default:
          return t('public.items.suggestions.terms', 'Search terms');
      }
    },
    [t]
  );

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

    const locations = Array.from(
      new Set(
        items
          .map((item) => item.business_location?.name?.trim())
          .filter(Boolean) as string[]
      )
    ).sort((a, b) => a.localeCompare(b));

    return { categories, subcategories, brands, locations };
  }, [items, filters.category]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          item.item.name.toLowerCase().includes(term) ||
          item.item.description?.toLowerCase().includes(term) ||
          item.item.sku?.toLowerCase().includes(term) ||
          item.item.brand?.name?.toLowerCase().includes(term) ||
          item.business_location?.name?.toLowerCase().includes(term) ||
          item.business_location?.business?.name?.toLowerCase().includes(term) ||
          (item.item.tags?.some((tag) =>
            tag.name.toLowerCase().includes(term)
          ) ??
            false);
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

      if (
        filters.location &&
        item.business_location?.name !== filters.location
      ) {
        return false;
      }

      return true;
    });
  }, [items, searchTerm, filters]);

  useLayoutEffect(() => {
    onFilterChange(filteredItems);
  }, [filteredItems, onFilterChange]);

  const handleFilterChange = (field: keyof ItemsPageFilterState, value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value,
      ...(field === 'category' ? { subcategory: '' } : {}),
    });
    if (field === 'location') {
      onLocationFilterChange?.(value);
    }
    void trackSiteEvent({
      eventType: SITE_EVENT_INVENTORY_FILTER_CHANGE,
      metadata: { field, value: value || null },
    });
  };

  const handleClearFilters = () => {
    onSearchSubmit('');
    onFiltersChange({
      category: '',
      subcategory: '',
      brand: '',
      location: '',
    });
    onClearFilters?.();
    void trackSiteEvent({
      eventType: SITE_EVENT_INVENTORY_FILTER_CLEAR,
    });
  };

  const activeFiltersCount = [
    searchTerm,
    filters.category,
    filters.subcategory,
    filters.brand,
    filters.location,
  ].filter(Boolean).length;

  const getActiveFilterChips = () => {
    const chips: { label: string; onDelete: () => void }[] = [];
    if (searchTerm) {
      chips.push({
        label: `${t('common.search', 'Search')}: "${searchTerm}"`,
        onDelete: () => onSearchSubmit(''),
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
    if (filters.location) {
      chips.push({
        label: `${t('common.location', 'Location')}: ${filters.location}`,
        onDelete: () => handleFilterChange('location', ''),
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

      <FormControl fullWidth size="small">
        <InputLabel>{t('common.location', 'Location')}</InputLabel>
        <Select
          value={filters.location}
          onChange={(e) => handleFilterChange('location', e.target.value)}
          label={t('common.location', 'Location')}
        >
          <MenuItem value="">{t('common.all', 'All')}</MenuItem>
          {filterOptions.locations.map((loc) => (
            <MenuItem key={loc} value={loc}>
              {loc}
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
            <Skeleton variant="rectangular" width={130} height={56} />
          </Box>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 3 }}>
      {/* Search bar - centered */}
      <Box
        component="form"
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          runSearch();
        }}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          mt: 2,
          mb: 2,
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{
            width: '100%',
            maxWidth: { xs: '100%', md: 900 },
            mx: 'auto',
          }}
        >
          <Autocomplete
            freeSolo
            options={suggestions}
            filterOptions={(options) => options}
            loading={suggestionsLoading}
            sx={{ flex: 1, minWidth: 0 }}
            inputValue={searchDraft}
            onInputChange={(_event, value) => setSearchDraft(value)}
            onChange={(_event, value) => {
              if (typeof value === 'string') {
                setSearchDraft(value);
                onSearchSubmit(value.trim());
                void trackSiteEvent({
                  eventType: SITE_EVENT_INVENTORY_SEARCH_SUGGESTION_SELECT,
                  metadata: { kind: 'term', value: value.trim() || null },
                });
                return;
              }
              if (!value) return;
              switch (value.kind) {
                case 'product':
                  void trackSiteEvent({
                    eventType: SITE_EVENT_INVENTORY_SEARCH_SUGGESTION_SELECT,
                    metadata: {
                      kind: 'product',
                      inventoryId: value.inventoryId,
                      title: value.title,
                    },
                  });
                  navigate(`/items/${value.inventoryId}`);
                  return;
                case 'category':
                  void trackSiteEvent({
                    eventType: SITE_EVENT_INVENTORY_SEARCH_SUGGESTION_SELECT,
                    metadata: { kind: 'category', value: value.value },
                  });
                  onFiltersChange({
                    ...filters,
                    category: value.value,
                    subcategory: '',
                  });
                  setSearchDraft('');
                  onSearchSubmit('');
                  return;
                case 'seller':
                  void trackSiteEvent({
                    eventType: SITE_EVENT_INVENTORY_SEARCH_SUGGESTION_SELECT,
                    metadata: { kind: 'seller', value: value.name },
                  });
                  setSearchDraft(value.name);
                  onSearchSubmit(value.name.trim());
                  return;
                case 'term':
                default:
                  void trackSiteEvent({
                    eventType: SITE_EVENT_INVENTORY_SEARCH_SUGGESTION_SELECT,
                    metadata: { kind: 'term', value: value.value },
                  });
                  setSearchDraft(value.value);
                  onSearchSubmit(value.value.trim());
                  return;
              }
            }}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              switch (option.kind) {
                case 'product':
                  return option.title;
                case 'seller':
                  return option.name;
                case 'category':
                case 'term':
                default:
                  return option.value;
              }
            }}
            groupBy={(option) => suggestionsGroupLabel(option.kind)}
            noOptionsText={t(
              'public.items.suggestions.noOptions',
              'No suggestions'
            )}
            loadingText={t('common.loading', 'Loading...')}
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                size="medium"
                variant="outlined"
                placeholder={t(
                  'public.items.searchPlaceholder',
                  'Search for items, shops, or categories…'
                )}
                autoComplete="off"
                helperText={undefined}
                inputProps={{
                  ...params.inputProps,
                  'aria-label': t(
                    'public.items.searchAria',
                    'Search the item catalog'
                  ),
                }}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <IconButton
                        type="button"
                        size="medium"
                        aria-label={t('public.items.searchButton', 'Search')}
                        onClick={runSearch}
                        edge="start"
                        sx={{ ml: -0.5 }}
                      >
                        <SearchIcon
                          sx={{
                            color: 'text.secondary',
                            opacity: 0.9,
                            fontSize: 22,
                          }}
                        />
                      </IconButton>
                    </InputAdornment>
                  ),
                  endAdornment: searchDraft ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="medium"
                        edge="end"
                        type="button"
                        aria-label={t(
                          'public.items.clearSearch',
                          'Clear search'
                        )}
                        onClick={() => {
                          setSearchDraft('');
                          onSearchSubmit('');
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : (
                    <InputAdornment position="end">
                      {suggestionsLoading ? (
                        <CircularProgress size={18} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </InputAdornment>
                  ),
                }}
                sx={(theme) => ({
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2.5,
                    minHeight: 56,
                    pl: 0.25,
                    bgcolor:
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.white, 0.06)
                        : alpha(theme.palette.common.black, 0.03),
                    transition: theme.transitions.create(
                      ['box-shadow', 'background-color', 'border-color'],
                      { duration: theme.transitions.duration.shorter }
                    ),
                    '&:hover': {
                      bgcolor:
                        theme.palette.mode === 'dark'
                          ? alpha(theme.palette.common.white, 0.09)
                          : alpha(theme.palette.common.black, 0.05),
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: alpha(theme.palette.primary.main, 0.45),
                      },
                    },
                    '&.Mui-focused': {
                      bgcolor: theme.palette.background.paper,
                      boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}`,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'primary.main',
                        borderWidth: 1,
                      },
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.divider,
                    },
                    '& .MuiOutlinedInput-input': {
                      py: 1.25,
                      typography: 'body1',
                    },
                  },
                })}
              />
            )}
            renderOption={(props, option) => {
              const content =
                option.kind === 'product' ? (
                  <>
                    <ListItemAvatar>
                      <Avatar
                        variant="rounded"
                        src={option.imageUrl ?? undefined}
                        alt={option.title}
                        sx={{ width: 32, height: 32 }}
                      />
                    </ListItemAvatar>
                    <ListItemText
                      primary={option.title}
                      secondary={new Intl.NumberFormat(undefined, {
                        style: 'currency',
                        currency: option.currency || 'XAF',
                      }).format(option.price ?? 0)}
                      primaryTypographyProps={{ noWrap: true }}
                      secondaryTypographyProps={{ noWrap: true }}
                    />
                  </>
                ) : option.kind === 'seller' ? (
                  <>
                    <ListItemAvatar>
                      <Avatar
                        variant="rounded"
                        src={option.logoUrl ?? undefined}
                        alt={option.name}
                        sx={{ width: 32, height: 32 }}
                      >
                        <StorefrontIcon fontSize="small" />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={option.name}
                      secondary={t(
                        'public.items.suggestions.sellerLabel',
                        'Seller'
                      )}
                      primaryTypographyProps={{ noWrap: true }}
                    />
                  </>
                ) : option.kind === 'category' ? (
                  <>
                    <ListItemAvatar>
                      <Avatar
                        variant="rounded"
                        sx={{ width: 32, height: 32 }}
                      >
                        <CategoryIcon fontSize="small" />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={option.value}
                      secondary={t(
                        'public.items.suggestions.categoryLabel',
                        'Category'
                      )}
                      primaryTypographyProps={{ noWrap: true }}
                    />
                  </>
                ) : (
                  <>
                    <ListItemAvatar>
                      <Avatar
                        variant="rounded"
                        sx={{ width: 32, height: 32 }}
                      >
                        <SearchIcon fontSize="small" />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={option.value}
                      primaryTypographyProps={{ noWrap: true }}
                    />
                  </>
                );

              return (
                <li {...props} key={`${option.kind}-${props.id}`}>
                  {content}
                </li>
              );
            }}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            sx={{
              minHeight: 52,
              px: 3,
              borderRadius: 2.5,
              flexShrink: 0,
              alignSelf: { xs: 'stretch', sm: 'center' },
            }}
          >
            {t('public.items.searchButton', 'Search')}
          </Button>
        </Stack>
      </Box>

      {!isMobile ? (
        /* Desktop: inline filters */
        <Box>
          <Grid container sx={{ width: '100%' }} spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>{t('common.location', 'Location')}</InputLabel>
                <Select
                  value={filters.location}
                  onChange={(e) =>
                    handleFilterChange('location', e.target.value)
                  }
                  label={t('common.location', 'Location')}
                >
                  <MenuItem value="">{t('common.all', 'All')}</MenuItem>
                  {filterOptions.locations.map((loc) => (
                    <MenuItem key={loc} value={loc}>
                      {loc}
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
