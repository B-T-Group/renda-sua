import {
  AccountCircle as AccountIcon,
  ShoppingCart as CartIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
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
import { Item } from '../../hooks/useItems';
import { usePublicItems } from '../../hooks/usePublicItems';
import SEOHead from '../seo/SEOHead';

const PublicItemsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Fetch all items (no business filter for public view)
  const { items, loading, error } = usePublicItems();

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

  const handleSignUp = () => {
    navigate('/auth/signup');
  };

  const handleLogin = () => {
    navigate('/auth/login');
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
          {t('public.items.resultsCount', { count: filteredItems.length })}
        </Typography>
      </Box>

      {/* Items Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {Array.from(new Array(itemsPerPage)).map((_, index) => (
            <Box
              key={index}
              sx={{
                flex: {
                  xs: '1 1 100%',
                  sm: '1 1 calc(50% - 12px)',
                  md: '1 1 calc(33.333% - 16px)',
                  lg: '1 1 calc(25% - 18px)',
                },
              }}
            >
              <Card>
                <Skeleton variant="rectangular" height={200} />
                <CardContent>
                  <Skeleton variant="text" height={24} sx={{ mb: 1 }} />
                  <Skeleton variant="text" height={20} sx={{ mb: 1 }} />
                  <Skeleton variant="text" height={20} width="60%" />
                </CardContent>
              </Card>
            </Box>
          ))}
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {paginatedItems.map((item) => (
              <Box
                key={item.id}
                sx={{
                  flex: {
                    xs: '1 1 100%',
                    sm: '1 1 calc(50% - 12px)',
                    md: '1 1 calc(33.333% - 16px)',
                    lg: '1 1 calc(25% - 18px)',
                  },
                }}
              >
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4,
                    },
                  }}
                >
                  <CardMedia
                    component="img"
                    height="200"
                    image={
                      item.item_images?.[0]?.image_url ||
                      '/src/assets/no-image.svg'
                    }
                    alt={item.name}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent
                    sx={{
                      flexGrow: 1,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <Typography variant="h6" component="h3" gutterBottom>
                      {item.name}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2, flexGrow: 1 }}
                    >
                      {item.description}
                    </Typography>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" color="primary" gutterBottom>
                        {t('public.items.price', {
                          price: item.price,
                          currency: item.currency || 'USD',
                        })}
                      </Typography>
                    </Box>

                    <Box
                      sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}
                    >
                      {item.item_sub_category?.item_category && (
                        <Chip
                          label={item.item_sub_category.item_category.name}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                      {item.brand && (
                        <Chip
                          label={item.brand.name}
                          size="small"
                          color="secondary"
                          variant="outlined"
                        />
                      )}
                    </Box>

                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<CartIcon />}
                      disabled
                      sx={{ mt: 'auto' }}
                    >
                      {t('public.items.signUpToPurchase')}
                    </Button>
                  </CardContent>
                </Card>
              </Box>
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
