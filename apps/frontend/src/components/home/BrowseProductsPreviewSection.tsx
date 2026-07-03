import { ArrowForward, ShoppingBag } from '@mui/icons-material';
import { Box, Button, Card, CardActionArea, CardContent, CardMedia, Container, Grid, Skeleton, Stack, Typography, alpha } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import AppStoreBadges from '../common/AppStoreBadges';
import { useInventoryItems, InventoryItem } from '../../hooks/useInventoryItems';

const ProductPreviewCard: React.FC<{ item: InventoryItem }> = ({ item }) => {
  const image = item.item?.item_images?.[0]?.image_url ?? '';
  const price = new Intl.NumberFormat('fr-FR').format(item.selling_price);
  const currency = item.item?.currency ?? 'XAF';
  return (
    <Card
      elevation={0}
      component={RouterLink}
      to={`/items/${item.id}`}
      sx={{
        border: '1.5px solid',
        borderColor: 'divider',
        borderRadius: 2.5,
        textDecoration: 'none',
        display: 'block',
        transition: 'all 0.2s ease',
        '&:hover': { borderColor: 'primary.main', transform: 'translateY(-3px)', boxShadow: '0 8px 24px rgba(30,64,175,0.1)' },
      }}
    >
      <CardActionArea>
        {image ? (
          <CardMedia component="img" height={160} image={image} alt={item.item?.name ?? ''} sx={{ objectFit: 'cover' }} />
        ) : (
          <Box sx={{ height: 160, bgcolor: alpha('#1e40af', 0.06), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingBag sx={{ fontSize: 40, color: alpha('#1e40af', 0.3) }} />
          </Box>
        )}
        <CardContent sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.item?.name}
          </Typography>
          <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 700 }}>
            {price} {currency}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

const BrowseProductsPreviewSection: React.FC = () => {
  const { t } = useTranslation();
  const shouldReduce = useReducedMotion();

  const { inventoryItems, loading } = useInventoryItems({ limit: 8, sort: 'top_rated' });

  return (
    <Box
      component="section"
      id="browse-products"
      sx={{ py: { xs: 8, md: 12 }, bgcolor: alpha('#1e40af', 0.02) }}
    >
      <Container maxWidth="xl">
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <motion.div
            initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Typography
              component="h2"
              sx={{
                fontSize: { xs: '2rem', md: '2.75rem' },
                fontWeight: 800,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
                color: 'text.primary',
                mb: 2,
              }}
            >
              {t('home.browse.title', "See what's available near you")}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 480, mx: 'auto' }}>
              {t('home.browse.subtitle', 'Hundreds of local products, ready to be delivered to your door.')}
            </Typography>
          </motion.div>
        </Box>

        {/* Products grid */}
        {loading ? (
          <Grid container spacing={2} sx={{ mb: 4 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Grid key={i} size={{ xs: 6, sm: 4, md: 3 }}>
                <Skeleton variant="rounded" height={280} sx={{ borderRadius: 2 }} />
              </Grid>
            ))}
          </Grid>
        ) : inventoryItems.length > 0 ? (
          <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: 4 }}>
            {inventoryItems.slice(0, 8).map((item, i) => (
              <Grid key={item.id} size={{ xs: 6, sm: 4, md: 3 }}>
                <motion.div
                  initial={{ opacity: 0, y: shouldReduce ? 0 : 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                >
                  <ProductPreviewCard item={item} />
                </motion.div>
              </Grid>
            ))}
          </Grid>
        ) : null}

        {/* CTA row */}
        <Box sx={{ textAlign: 'center' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" alignItems="center">
            <Button
              component={RouterLink}
              to="/items"
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
              sx={{ fontWeight: 700, px: 4 }}
            >
              {t('home.browse.cta', 'Browse all items')}
            </Button>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75, textAlign: 'center' }}>
                {t('home.browse.appNote', 'Best experience in the app')}
              </Typography>
              <AppStoreBadges variant="compact" sourceSection="browse_preview" />
            </Box>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default BrowseProductsPreviewSection;
