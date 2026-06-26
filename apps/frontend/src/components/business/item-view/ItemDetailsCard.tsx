import {
  AutoFixHigh as AutoFixHighIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Item } from '../../../hooks/useItems';
import { formatItemCurrency, formatItemDate } from './itemViewHelpers';

interface ItemDetailsCardProps {
  item: Item;
  canSuperUserActions: boolean;
  onManageCollections: () => void;
  onRefineWithAi: () => void;
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, children }) => (
  <Box>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    {children}
  </Box>
);

const ItemDetailsCard: React.FC<ItemDetailsCardProps> = ({
  item,
  canSuperUserActions,
  onManageCollections,
  onRefineWithAi,
}) => {
  const { t } = useTranslation();
  const hasSpecialHandling =
    item.is_fragile || item.is_perishable || item.requires_special_handling;

  return (
    <Card>
      <CardContent>
        <Stack spacing={1.5} sx={{ mb: 1 }}>
          <Typography variant="h6" fontWeight="bold">
            {t('business.items.details', 'Item Details')}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {canSuperUserActions && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<CategoryIcon />}
                onClick={onManageCollections}
                sx={{ flex: 1, minWidth: 140 }}
              >
                {t('business.items.collections.title', 'Collections')}
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              startIcon={<AutoFixHighIcon />}
              onClick={onRefineWithAi}
              sx={{ flex: 1, minWidth: 140 }}
            >
              {t('business.items.refineWithAi.title', 'Refine with AI')}
            </Button>
          </Stack>
        </Stack>
        <Divider sx={{ mb: 2 }} />

        <Stack spacing={2}>
          <Field label={t('business.items.description', 'Description')}>
            <Typography variant="body2">
              {item.description ||
                t('business.items.noDescription', 'No description')}
            </Typography>
          </Field>

          <Field label={t('business.items.price', 'Base Price')}>
            <Typography variant="h5" color="primary" fontWeight="bold">
              {formatItemCurrency(item.price, item.currency)}
            </Typography>
          </Field>

          {item.brand && (
            <Field label={t('business.items.brand', 'Brand')}>
              <Typography variant="body2">{item.brand.name}</Typography>
            </Field>
          )}

          {item.item_sub_category && (
            <Field label={t('business.items.category', 'Category')}>
              <Typography variant="body2">
                {item.item_sub_category.item_category?.name} ›{' '}
                {item.item_sub_category.name}
              </Typography>
            </Field>
          )}

          {item.item_tags && item.item_tags.length > 0 && (
            <Field label={t('business.items.tags', 'Tags')}>
              <Box
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}
              >
                {item.item_tags.map((it) => (
                  <Chip
                    key={it.tag.id}
                    label={it.tag.name}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Field>
          )}

          {item.model && (
            <Field label={t('business.items.model', 'Model')}>
              <Typography variant="body2">{item.model}</Typography>
            </Field>
          )}

          {item.color && (
            <Field label={t('business.items.color', 'Color')}>
              <Typography variant="body2">{item.color}</Typography>
            </Field>
          )}

          {item.weight && (
            <Field label={t('business.items.weight', 'Weight')}>
              <Typography variant="body2">
                {`${item.weight} ${item.weight_unit}`}
              </Typography>
            </Field>
          )}

          {item.dimensions && (
            <Field label={t('business.items.dimensions', 'Dimensions')}>
              <Typography variant="body2">{item.dimensions}</Typography>
            </Field>
          )}

          <Field label={t('business.items.orderLimits', 'Order Limits')}>
            <Typography variant="body2">
              {t('business.items.minOrder', 'Min')}: {item.min_order_quantity}
              {item.max_order_quantity &&
                ` • ${t('business.items.maxOrder', 'Max')}: ${
                  item.max_order_quantity
                }`}
            </Typography>
          </Field>

          {hasSpecialHandling && (
            <Field
              label={t('business.items.specialHandling', 'Special Handling')}
            >
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                {item.is_fragile && (
                  <Chip
                    label={t('business.items.fragile', 'Fragile')}
                    size="small"
                    color="warning"
                  />
                )}
                {item.is_perishable && (
                  <Chip
                    label={t('business.items.perishable', 'Perishable')}
                    size="small"
                    color="error"
                  />
                )}
                {item.requires_special_handling && (
                  <Chip
                    label={t('business.items.requiresSpecial', 'Special')}
                    size="small"
                    color="info"
                  />
                )}
              </Stack>
            </Field>
          )}

          <Field label={t('business.items.createdAt', 'Created')}>
            <Typography variant="body2">
              {formatItemDate(item.created_at)}
            </Typography>
          </Field>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ItemDetailsCard;
