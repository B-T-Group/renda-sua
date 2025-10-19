import { useAuth0 } from '@auth0/auth0-react';
import {
  AccountCircle as AccountIcon,
  Close,
  FilterList,
  Login,
  Search as SearchIcon,
  ShoppingCart,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Container,
  Drawer,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Skeleton,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  InventoryItem,
  useInventoryItems,
} from '../../hooks/useInventoryItems';
import DashboardItemCard from '../common/DashboardItemCard';
import SEOHead from '../seo/SEOHead';

// ItemCardSkeleton component for better loading UX
const ItemCardSkeleton: React.FC = () => (
  <Card sx={{ height: '100%' }}>
    <Skeleton variant="rectangular" height={240} />
    <CardContent sx={{ p: 2 }}>
      <Skeleton variant="text" width="40%" height={20} sx={{ mb: 1 }} />
      <Skeleton variant="text" width="80%" height={28} sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Skeleton
          variant="rectangular"
          width={80}
          height={32}
          sx={{ borderRadius: 1 }}
        />
        <Skeleton
          variant="rectangular"
          width={100}
          height={24}
          sx={{ borderRadius: 3 }}
        />
      </Box>
      <Skeleton variant="text" width="60%" height={20} sx={{ mb: 1 }} />
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Skeleton
          variant="rectangular"
          width={60}
          height={20}
          sx={{ borderRadius: 2 }}
        />
        <Skeleton
          variant="rectangular"
          width={60}
          height={20}
          sx={{ borderRadius: 2 }}
        />
      </Box>
    </CardContent>
    <CardActions sx={{ p: 2, pt: 0 }}>
      <Skeleton
        variant="rectangular"
        width="100%"
        height={40}
        sx={{ borderRadius: 1 }}
      />
    </CardActions>
  </Card>
);

const PublicItemsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const { profile } = useUserProfileContext();
  const { addToCart } = useCart();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const itemsPerPage = 12;

  // Fetch all inventory items for public view
  const { inventoryItems, loading, error } = useInventoryItems({
    page: 1,
    limit: 1000, // Get all items for client-side filtering
    is_active: true,
  });

  // Filter inventory items based on search and filters
  const filteredItems = inventoryItems.filter(
    (inventoryItem: InventoryItem) => {
      const matchesSearch =
        inventoryItem.item.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        inventoryItem.item.description
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());
      const matchesCategory =
        !selectedCategory ||
        inventoryItem.item.item_sub_category?.item_category?.name ===
          selectedCategory;
      const matchesBrand =
        !selectedBrand || inventoryItem.item.brand?.name === selectedBrand;

      return matchesSearch && matchesCategory && matchesBrand;
    }
  );

  // Sort items based on selected sort option
  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return a.selling_price - b.selling_price;
      case 'price-high':
        return b.selling_price - a.selling_price;
      case 'name':
        return a.item.name.localeCompare(b.item.name);
      case 'newest':
      default:
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
  const paginatedItems = sortedItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get unique categories and brands for filters
  const categories = [
    ...new Set(
      inventoryItems
        .map((invItem) => invItem.item.item_sub_category?.item_category?.name)
        .filter(Boolean)
    ),
  ];
  const brands = [
    ...new Set(
      inventoryItems.map((invItem) => invItem.item.brand?.name).filter(Boolean)
    ),
  ];

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setCurrentPage(value);
    // Smooth scroll to top of page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedBrand('');
    setCurrentPage(1);
  };

  // Handler functions
  const handleSignUp = () => {
    navigate('/auth/signup');
  };

  const handleLogin = () => {
    loginWithRedirect();
  };

  // Check if user is a client (can place orders)
  const isClient =
    isAuthenticated &&
    profile?.client !== null &&
    profile?.client !== undefined;

  const handleOrderClick = (item: InventoryItem) => {
    if (!isAuthenticated) {
      handleLogin();
      return;
    }
    // For authenticated users, redirect to place order page for this specific item
    navigate(`/items/${item.id}/place_order`);
  };

  const handleAddToCart = (item: InventoryItem) => {
    if (!isAuthenticated) {
      handleLogin();
      return;
    }

    addToCart({
      inventoryItemId: item.id,
      quantity: 1,
      businessId: item.business_location.business_id,
      businessLocationId: item.business_location_id,
      itemData: {
        name: item.item.name,
        price: item.selling_price,
        currency: item.item.currency,
        imageUrl: item.item.item_images?.[0]?.image_url,
        weight: item.item.weight,
      },
    });
  };

  // Format currency helper
  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Popular search terms
  const popularSearches = [
    'Electronics',
    'Clothing',
    'Food',
    'Home Decor',
    'Books',
    'Sports',
  ];

  // Check if any filters are active
  const hasActiveFilters = searchTerm || selectedCategory || selectedBrand;

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">{t('common.errorLoadingData')}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <SEOHead
        title={t('seo.public-items.title')}
        description={t('seo.public-items.description')}
        keywords={t('seo.public-items.keywords')}
      />

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight={700}>
          {t('public.items.title', 'Browse Items')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {t(
            'public.items.subtitle',
            'Discover great products from verified sellers'
          )}
        </Typography>

        {/* Enhanced Authentication CTA - Only for non-authenticated users */}
        {!isAuthenticated && (
          <Paper
            elevation={0}
            sx={{
              mb: 4,
              p: { xs: 3, md: 4 },
              background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
              color: 'white',
              borderRadius: 3,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(30, 64, 175, 0.2)',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background:
                  'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.08) 0%, transparent 50%)',
                pointerEvents: 'none',
              },
            }}
          >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}
              >
                <ShoppingCart sx={{ fontSize: 40, color: 'white' }} />
                <Typography
                  variant="h5"
                  fontWeight={700}
                  sx={{
                    color: 'white',
                    textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  {t('public.items.ctaTitle', 'Ready to start shopping?')}
                </Typography>
              </Box>
              <Typography
                variant="body1"
                sx={{
                  mb: 3,
                  color: 'white',
                  fontSize: '1.1rem',
                  lineHeight: 1.6,
                  textShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  fontWeight: 500,
                }}
              >
                {t(
                  'public.items.ctaSubtitle',
                  'Sign in to place orders, track deliveries, and access exclusive deals from verified sellers.'
                )}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleLogin}
                  startIcon={<Login />}
                  sx={{
                    bgcolor: 'white',
                    color: 'primary.main',
                    fontWeight: 600,
                    px: 4,
                    '&:hover': {
                      bgcolor: 'grey.100',
                    },
                  }}
                >
                  {t('public.items.signIn', 'Sign In')}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={handleSignUp}
                  startIcon={<AccountIcon />}
                  sx={{
                    borderColor: 'white',
                    color: 'white',
                    fontWeight: 600,
                    px: 4,
                    borderWidth: 2,
                    '&:hover': {
                      borderColor: 'white',
                      bgcolor: 'rgba(255,255,255,0.1)',
                      borderWidth: 2,
                    },
                  }}
                >
                  {t('public.items.createAccount', 'Create Account')}
                </Button>
              </Box>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Filters Section */}
      {isMobile ? (
        <>
          {/* Mobile Filter Button */}
          <Button
            fullWidth
            variant="outlined"
            startIcon={<FilterList />}
            onClick={() => setFiltersOpen(true)}
            sx={{ mb: 3 }}
          >
            {t('public.items.filters', 'Filters')}
            {hasActiveFilters && (
              <Chip
                label={
                  (searchTerm ? 1 : 0) +
                  (selectedCategory ? 1 : 0) +
                  (selectedBrand ? 1 : 0)
                }
                size="small"
                color="primary"
                sx={{ ml: 1, height: 20, fontSize: '0.75rem' }}
              />
            )}
          </Button>

          {/* Mobile Filter Drawer */}
          <Drawer
            anchor="bottom"
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            PaperProps={{
              sx: {
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                maxHeight: '80vh',
              },
            }}
          >
            <Box sx={{ p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 3,
                }}
              >
                <Typography variant="h6" fontWeight={700}>
                  {t('public.items.filters', 'Filters')}
                </Typography>
                <IconButton onClick={() => setFiltersOpen(false)}>
                  <Close />
                </IconButton>
              </Box>

              {/* Filter Controls */}
              <TextField
                fullWidth
                placeholder={t(
                  'public.items.searchPlaceholder',
                  'Search items...'
                )}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>
                  {t('public.items.category', 'Category')}
                </InputLabel>
                <Select
                  value={selectedCategory}
                  label={t('public.items.category', 'Category')}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <MenuItem value="">
                    {t('public.items.allCategories', 'All Categories')}
                  </MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>{t('public.items.brand', 'Brand')}</InputLabel>
                <Select
                  value={selectedBrand}
                  label={t('public.items.brand', 'Brand')}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                >
                  <MenuItem value="">
                    {t('public.items.allBrands', 'All Brands')}
                  </MenuItem>
                  {brands.map((brand) => (
                    <MenuItem key={brand} value={brand}>
                      {brand}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={() => setFiltersOpen(false)}
                sx={{ mt: 2 }}
              >
                {t('public.items.showResults', 'Show {count} Results', {
                  count: filteredItems.length,
                })}
              </Button>
            </Box>
          </Drawer>
        </>
      ) : (
        /* Desktop Inline Filters */
        <Box sx={{ mb: 4 }}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                flex: {
                  xs: '1 1 100%',
                  sm: '1 1 calc(50% - 8px)',
                  md: '1 1 calc(33.333% - 16px)',
                },
              }}
            >
              <TextField
                fullWidth
                placeholder={t(
                  'public.items.searchPlaceholder',
                  'Search items...'
                )}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box
              sx={{
                flex: {
                  xs: '1 1 100%',
                  sm: '1 1 calc(50% - 8px)',
                  md: '1 1 calc(33.333% - 16px)',
                },
              }}
            >
              <FormControl fullWidth>
                <InputLabel>
                  {t('public.items.category', 'Category')}
                </InputLabel>
                <Select
                  value={selectedCategory}
                  label={t('public.items.category', 'Category')}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <MenuItem value="">
                    {t('public.items.allCategories', 'All Categories')}
                  </MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box
              sx={{
                flex: {
                  xs: '1 1 100%',
                  sm: '1 1 calc(50% - 8px)',
                  md: '1 1 calc(33.333% - 16px)',
                },
              }}
            >
              <FormControl fullWidth>
                <InputLabel>{t('public.items.brand', 'Brand')}</InputLabel>
                <Select
                  value={selectedBrand}
                  label={t('public.items.brand', 'Brand')}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                >
                  <MenuItem value="">
                    {t('public.items.allBrands', 'All Brands')}
                  </MenuItem>
                  {brands.map((brand) => (
                    <MenuItem key={brand} value={brand}>
                      {brand}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Box>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            flexWrap: 'wrap',
            mb: 3,
          }}
        >
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {t('public.items.activeFilters', 'Active filters:')}
          </Typography>
          {searchTerm && (
            <Chip
              label={`${t('common.search', 'Search')}: "${searchTerm}"`}
              onDelete={() => setSearchTerm('')}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
          {selectedCategory && (
            <Chip
              label={`${t(
                'public.items.category',
                'Category'
              )}: ${selectedCategory}`}
              onDelete={() => setSelectedCategory('')}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
          {selectedBrand && (
            <Chip
              label={`${t('public.items.brand', 'Brand')}: ${selectedBrand}`}
              onDelete={() => setSelectedBrand('')}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
          <Button size="small" onClick={handleClearFilters} sx={{ ml: 'auto' }}>
            {t('public.items.clearAllFilters', 'Clear All Filters')}
          </Button>
        </Box>
      )}

      {/* Popular Searches - Only show when no filters active and items available */}
      {!hasActiveFilters && inventoryItems.length > 0 && !loading && (
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            gutterBottom
            fontWeight={600}
          >
            {t('public.items.popularSearches', 'Popular searches:')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {popularSearches.map((term) => (
              <Chip
                key={term}
                label={term}
                onClick={() => setSearchTerm(term)}
                variant="outlined"
                size="small"
                clickable
                sx={{
                  '&:hover': {
                    bgcolor: 'primary.light',
                    color: 'white',
                    borderColor: 'primary.main',
                  },
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Results Count and Sorting */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="body1" fontWeight={600}>
          {filteredItems.length === 0
            ? t('public.items.noItems', 'No items found')
            : `${filteredItems.length} ${
                filteredItems.length === 1
                  ? t('common.item', 'item')
                  : t('common.items', 'items')
              } ${t('common.available', 'available')}`}
          {hasActiveFilters && inventoryItems.length > 0 && (
            <Typography component="span" color="text.secondary" sx={{ ml: 1 }}>
              {t('public.items.filteredFrom', '(filtered from {total} total)', {
                total: inventoryItems.length,
              })}
            </Typography>
          )}
        </Typography>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>{t('public.items.sortBy', 'Sort by')}</InputLabel>
          <Select
            value={sortBy}
            label={t('public.items.sortBy', 'Sort by')}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <MenuItem value="newest">
              {t('public.items.sortNewest', 'Newest First')}
            </MenuItem>
            <MenuItem value="price-low">
              {t('public.items.sortPriceLow', 'Price: Low to High')}
            </MenuItem>
            <MenuItem value="price-high">
              {t('public.items.sortPriceHigh', 'Price: High to Low')}
            </MenuItem>
            <MenuItem value="name">
              {t('public.items.sortName', 'Name A-Z')}
            </MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Items Grid */}
      {loading ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
            gap: 3,
          }}
        >
          {Array.from(new Array(itemsPerPage)).map((_, index) => (
            <ItemCardSkeleton key={index} />
          ))}
        </Box>
      ) : filteredItems.length === 0 ? (
        /* Enhanced Empty State */
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            px: 2,
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'grey.100',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
            }}
          >
            <SearchIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
          </Box>
          <Typography variant="h5" gutterBottom fontWeight={600}>
            {hasActiveFilters
              ? t('public.items.noMatchingItems', 'No items match your filters')
              : t('public.items.noItemsAvailable', 'No items available yet')}
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}
          >
            {hasActiveFilters
              ? t(
                  'public.items.tryDifferentFilters',
                  "Try adjusting your filters or search terms to find what you're looking for."
                )
              : t(
                  'public.items.checkBackSoon',
                  'Check back soon for new items from our sellers.'
                )}
          </Typography>
          {hasActiveFilters && (
            <Button
              variant="outlined"
              size="large"
              onClick={handleClearFilters}
            >
              {t('public.items.clearAllFilters', 'Clear All Filters')}
            </Button>
          )}
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(4, 1fr)',
              },
              gap: 3,
            }}
          >
            {paginatedItems.map((inventoryItem) => (
              <DashboardItemCard
                key={inventoryItem.id}
                item={inventoryItem}
                formatCurrency={formatCurrency}
                onOrderClick={handleOrderClick}
                onAddToCart={handleAddToCart}
                estimatedDistance={null}
                estimatedDuration={null}
                distanceLoading={false}
                distanceError={null}
                isPublicView={!isAuthenticated}
                canOrder={!isAuthenticated || isClient}
                showCartButtons={isAuthenticated && isClient}
                loginButtonText={t('public.items.login', 'Sign In to Order')}
                orderButtonText={t('common.orderNow', 'Order Now')}
                addToCartButtonText={t('cart.addToCart', 'Add to Cart')}
                buyNowButtonText={t('cart.buyNow', 'Buy Now')}
              />
            ))}
          </Box>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default PublicItemsPage;
