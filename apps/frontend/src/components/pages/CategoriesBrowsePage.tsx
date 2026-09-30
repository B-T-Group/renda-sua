import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  CircularProgress,
  Container,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CategoryPoster } from '../catalog-experience/CategoryPoster';
import type { CatalogCategoryTile } from '../catalog-experience/catalogExperience.types';
import { useCatalogCategories } from '../../hooks/useCatalogCategories';
import SEOHead from '../seo/SEOHead';
import { MarketSelector } from '../market/MarketSelector';
import { CategoryBrowseEmpty } from './CategoryBrowseEmpty';

const CategoriesBrowsePage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { categories, loading } = useCatalogCategories();
  const visible = useMemo(() => filterCategories(categories, search), [categories, search]);
  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 5, px: { xs: 1.5, sm: 2 } }}>
      <CategoriesPageHeader />
      <Box sx={{ mb: 2 }}>
        <MarketSelector catalogContext="inventory" />
      </Box>
      <CategorySearch value={search} onChange={setSearch} />
      <CategoryResults
        loading={loading}
        categories={visible}
        searching={search.trim().length > 0}
        onOpen={(name) => navigate(`/items?category=${encodeURIComponent(name)}`)}
      />
    </Container>
  );
};

function CategoriesPageHeader() {
  const { t } = useTranslation();
  const title = t('public.items.categoriesPage.title', 'Categories');
  return (
    <>
      <SEOHead
        title={title}
        description={t(
          'public.items.categoriesPage.description',
          'Browse every category available in your market'
        )}
      />
      <Typography variant="h4" fontWeight={800}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        {t('public.items.categoriesPage.subtitle', 'Find a category, then shop its items.')}
      </Typography>
    </>
  );
}

function CategorySearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  return (
    <TextField
      fullWidth
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={t('public.items.categoriesPage.search', 'Search categories')}
      sx={{ mb: 2.5, maxWidth: 480 }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" />
          </InputAdornment>
        ),
      }}
    />
  );
}

function CategoryResults({
  loading,
  categories,
  searching,
  onOpen,
}: {
  loading: boolean;
  categories: CatalogCategoryTile[];
  searching: boolean;
  onOpen: (name: string) => void;
}) {
  if (loading) return <CircularProgress size={28} />;
  if (categories.length === 0) return <CategoryBrowseEmpty searching={searching} />;
  return <CategoryGrid categories={categories} onOpen={onOpen} />;
}

function CategoryGrid({
  categories,
  onOpen,
}: {
  categories: CatalogCategoryTile[];
  onOpen: (name: string) => void;
}) {
  return (
    <Box sx={gridSx}>
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} onOpen={onOpen} />
      ))}
    </Box>
  );
}

function CategoryCard({
  category,
  onOpen,
}: {
  category: CatalogCategoryTile;
  onOpen: (name: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Box sx={{ aspectRatio: '4 / 5' }}>
      <CategoryPoster
        name={category.name}
        imageUrl={category.imageUrl}
        countLabel={t('public.items.sections.categoryItemCount', '{{count}} items', {
          count: category.listingCount,
        })}
        ariaLabel={t('public.items.sections.categoryTileA11y', 'Browse {{name}}', {
          name: category.name,
        })}
        onSelect={() => onOpen(category.name)}
      />
    </Box>
  );
}

function filterCategories(
  categories: CatalogCategoryTile[],
  search: string
) {
  const query = search.trim().toLowerCase();
  if (!query) return categories;
  return categories.filter((category) => category.name.toLowerCase().includes(query));
}

const gridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(3, minmax(0, 1fr))',
    md: 'repeat(4, minmax(0, 1fr))',
    lg: 'repeat(5, minmax(0, 1fr))',
  },
  gap: 1.5,
};

export default CategoriesBrowsePage;
