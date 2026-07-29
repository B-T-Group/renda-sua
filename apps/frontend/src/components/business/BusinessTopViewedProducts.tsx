import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import {
  Box,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Skeleton,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface TopViewedProduct {
  inventoryItemId: string;
  itemId: string;
  itemName: string;
  imageUrl: string | null;
  viewsCount: number;
}

export interface BusinessTopViewedProductsProps {
  products: TopViewedProduct[];
  loading: boolean;
  onProductClick?: (product: TopViewedProduct) => void;
}

export function BusinessTopViewedProducts({
  products,
  loading,
  onProductClick,
}: BusinessTopViewedProductsProps) {
  const { t } = useTranslation();

  if (!loading && products.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        mb: 3,
        p: 2,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.6 }}>
        {t('business.dashboard.topViewed.title', 'Top viewed products')}
      </Typography>
      {loading ? (
        <Box sx={{ mt: 1 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 1 }} />
          ))}
        </Box>
      ) : (
        <List disablePadding sx={{ mt: 0.5 }}>
          {products.map((product, index) => (
            <TopViewedRow
              key={product.itemId}
              product={product}
              rank={index + 1}
              onClick={onProductClick}
            />
          ))}
        </List>
      )}
    </Box>
  );
}

function TopViewedRow({
  product,
  rank,
  onClick,
}: {
  product: TopViewedProduct;
  rank: number;
  onClick?: (product: TopViewedProduct) => void;
}) {
  const { t } = useTranslation();
  const clickable = Boolean(onClick && product.itemId);

  return (
    <ListItemButton
      disabled={!clickable}
      onClick={() => onClick?.(product)}
      sx={{ borderRadius: 1, px: 1 }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ width: 24, fontWeight: 700, flexShrink: 0 }}
      >
        {rank}
      </Typography>
      <ListItemAvatar sx={{ minWidth: 48 }}>
        <Avatar
          src={product.imageUrl ?? undefined}
          variant="rounded"
          alt=""
          sx={{ width: 40, height: 40, bgcolor: 'action.hover' }}
        >
          <Inventory2OutlinedIcon fontSize="small" />
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={product.itemName}
        secondary={t('business.dashboard.topViewed.views', '{{count}} views', {
          count: product.viewsCount,
        })}
        primaryTypographyProps={{ noWrap: true, fontWeight: 600 }}
        secondaryTypographyProps={{ noWrap: true }}
      />
      {clickable ? <ChevronRightRoundedIcon color="action" /> : null}
    </ListItemButton>
  );
}

export default BusinessTopViewedProducts;
