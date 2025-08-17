import { useAuth0 } from '@auth0/auth0-react';
import {
  AccountCircle as AccountIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Container,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { InventoryItem } from '../../hooks/useInventoryItems';
import { Item } from '../../hooks/useItems';
import { usePublicItems } from '../../hooks/usePublicItems';
import DashboardItemCard from '../common/DashboardItemCard';
import SEOHead from '../seo/SEOHead';

// Adapter function to convert Item to InventoryItem format for DashboardItemCard
const adaptItemToInventoryItem = (item: Item): InventoryItem => {
  return {
    id: `public-${item.id}`, // Use a different ID format for public items
    business_location_id: '',
    item_id: item.id,
    available_quantity: 1, // Default to 1 for public view
    selling_price: item.price,
    is_active: item.is_active,
    created_at: item.created_at,
    updated_at: item.updated_at,
    item: {
      id: item.id,
      name: item.name,
      description: item.description || '',
      price: item.price,
      currency: item.currency,
      weight: item.weight || 0,
      weight_unit: item.weight_unit || '',
      size: item.size || 0,
      size_unit: item.size_unit || '',
      item_sub_category_id: item.item_sub_category_id,
      sku: item.sku || '',
      brand: item.brand || { id: '', name: '' },
      model: item.model || '',
      color: item.color || '',
      material: item.material || '',
      is_fragile: item.is_fragile,
      is_perishable: item.is_perishable,
      requires_special_handling: item.requires_special_handling,
      max_delivery_distance: item.max_delivery_distance || 0,
      estimated_delivery_time: item.estimated_delivery_time || 0,
      min_order_quantity: item.min_order_quantity,
      max_order_quantity: item.max_order_quantity || 0,
      is_active: item.is_active,
      created_at: item.created_at,
      updated_at: item.updated_at,
      item_sub_category: item.item_sub_category || {
        id: 0,
        name: '',
        item_category: { id: 0, name: '' },
      },
      item_images: (item.item_images || []).map((img) => ({
        ...img,
        display_order: img.display_order || 0,
        alt_text: img.alt_text || '',
        caption: img.caption || '',
      })),
    },
    business_location: {
      id: '',
      business_id: item.business_id,
      name: item.business?.name || 'Unknown Business',
      location_type: 'store',
      is_primary: true,
      business: {
        id: item.business_id,
        name: item.business?.name || 'Unknown Business',
        is_verified: item.business?.is_verified || false,
      },
      address: {
        id: '',
        address_line_1: '',
        address_line_2: '',
        city: 'Unknown',
        state: 'Unknown',
        postal_code: '',
        country: '',
      },
    },
  };
};

const PublicItemsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const { userType, isProfileComplete } = useUserProfileContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Fetch all items (no business filter for public view)
  const { items, loading, error } = usePublicItems();

  // Check if user is an authenticated client
  const isAuthenticatedClient =
    isAuthenticated && userType === 'client' && isProfileComplete;

  // Filter items based on search and filters
  const filteredItems = items.filter((item: Item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      !selectedCategory ||
      item.item_sub_category?.item_category?.name === selectedCategory;
    const matchesBrand = !selectedBrand || item.brand?.name === selectedBrand;

    return matchesSearch && matchesCategory && matchesBrand;
  });

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get unique categories and brands for filters
  const categories = [
    ...new Set(
      items
        .map((item: Item) => item.item_sub_category?.item_category?.name)
        .filter(Boolean)
    ),
  ];
  const brands = [
    ...new Set(items.map((item: Item) => item.brand?.name).filter(Boolean)),
  ];

  const handlePageChange = (
    event: React.ChangeEvent<unknown>,
    value: number
  ) => {
    setCurrentPage(value);
  };

  // Handler functions
  const handleSignUp = () => {
    navigate('/auth/signup');
  };

  const handleLogin = () => {
    loginWithRedirect();
  };

  const handleOrderClick = (item: InventoryItem) => {
    if (!isAuthenticatedClient) {
      handleLogin();
      return;
    }
    // For authenticated clients, redirect to dashboard to place order
    navigate('/dashboard');
  };

  const handleTopUpClick = () => {
    navigate('/dashboard');
  };

  // Format currency helper
  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

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
        <Typography variant="h3" component="h1" gutterBottom>
          {t('public.items.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {t('public.items.subtitle')}
        </Typography>

        {/* Authentication Alert */}
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                color="inherit"
                size="small"
                onClick={handleSignUp}
                startIcon={<AccountIcon />}
              >
                {t('public.items.signUp')}
              </Button>
              <Button color="inherit" size="small" onClick={handleLogin}>
                {t('public.items.login')}
              </Button>
            </Box>
          }
        >
          {t('public.items.authenticationMessage')}
        </Alert>
      </Box>

      {/* Filters */}
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
              placeholder={t('public.items.searchPlaceholder')}
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
              <InputLabel>{t('public.items.category')}</InputLabel>
              <Select
                value={selectedCategory}
                label={t('public.items.category')}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <MenuItem value="">{t('public.items.allCategories')}</MenuItem>
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
              <InputLabel>{t('public.items.brand')}</InputLabel>
              <Select
                value={selectedBrand}
                label={t('public.items.brand')}
                onChange={(e) => setSelectedBrand(e.target.value)}
              >
                <MenuItem value="">{t('public.items.allBrands')}</MenuItem>
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

      {/* Results Count */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {t('common.showing')} {filteredItems.length}{' '}
          {filteredItems.length === 1 ? 'item' : 'items'}
        </Typography>
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
            <Skeleton
              key={index}
              variant="rectangular"
              height={400}
              sx={{ borderRadius: 1 }}
            />
          ))}
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
            {paginatedItems.map((item) => {
              const adaptedItem = adaptItemToInventoryItem(item);
              return (
                <DashboardItemCard
                  key={item.id}
                  item={adaptedItem}
                  canAfford={isAuthenticatedClient} // Only clients can afford items
                  formatCurrency={formatCurrency}
                  onOrderClick={handleOrderClick}
                  onTopUpClick={handleTopUpClick}
                  insufficientFundsMessage={
                    isAuthenticatedClient
                      ? undefined
                      : t('public.items.authenticationMessage')
                  }
                  estimatedDistance={null}
                  estimatedDuration={null}
                  distanceLoading={false}
                  distanceError={null}
                  isPublicView={true}
                  loginButtonText={t('public.items.login')}
                  orderButtonText={t('common.orderNow', 'Order Now')}
                />
              );
            })}
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

          {/* No Results */}
          {filteredItems.length === 0 && !loading && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {t('public.items.noItemsFound')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('public.items.tryDifferentFilters')}
              </Typography>
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default PublicItemsPage;
