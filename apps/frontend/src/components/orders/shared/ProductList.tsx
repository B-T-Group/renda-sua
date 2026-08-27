import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { MoneyDisplay } from './MoneyDisplay';

export interface ProductListItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice?: number | null;
  totalPrice?: number | null;
  currency?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  /** Cooked food only: helps the kitchen sequence and agents time pickup. */
  preparationMinutes?: number | null;
}

export interface ProductListProps {
  items: ProductListItem[];
  title?: string;
  showPrices?: boolean;
  emptyLabel?: string;
}

export const ProductList: React.FC<ProductListProps> = ({
  items,
  title,
  showPrices = true,
  emptyLabel,
}) => {
  const { t } = useTranslation();

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          {title ?? t('orders.orderCard.items', 'Items')}
        </Typography>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {emptyLabel ?? t('orders.items.empty', 'No items')}
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {items.map((item) => (
              <Stack
                key={item.id}
                direction="row"
                spacing={1.5}
                alignItems="flex-start"
                justifyContent="space-between"
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {item.quantity}× {item.name}
                  </Typography>
                  {item.preparationMinutes ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      {t('foods.prepMinutes', '~{{count}} min prep', {
                        count: item.preparationMinutes,
                      })}
                    </Typography>
                  ) : null}
                  {item.notes ? (
                    <Typography variant="caption" color="text.secondary">
                      {item.notes}
                    </Typography>
                  ) : null}
                </Box>
                {showPrices && item.totalPrice != null ? (
                  <MoneyDisplay
                    amount={item.totalPrice}
                    currency={item.currency}
                    variant="body2"
                  />
                ) : null}
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductList;
